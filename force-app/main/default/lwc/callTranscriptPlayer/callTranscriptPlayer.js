import { LightningElement, api, track } from 'lwc';
import getTranscriptContent from '@salesforce/apex/VoicecallSessionController.getTranscriptContent';
import parseTranscript from '@salesforce/apex/VoicecallSessionController.parseTranscript';
import Logger from 'c/loggerService';

// Initialize component logger
const log = Logger.create('CallTranscriptPlayer');

export default class CallTranscriptPlayer extends LightningElement {
    @api sessionId;
    @api audioUrl;
    
    _documents = [];
    _documentsProcessed = false;

    @api
    get documents() {
        return this._documents;
    }
    set documents(value) {
        this._documents = value || [];
        // Process documents whenever they're set/updated
        if (!this._documentsProcessed) {
            this._documentsProcessed = true;
            this.processDocuments();
        }
    }

    @track recordings = [];
    @track selectedRecordingId = null;
    componentVersion = 'v4'; // Version marker for debugging
    @track transcriptEntries = [];
    @track isLoadingTranscript = true;
    @track isLoadingRecordings = true;
    @track currentTime = 0;
    @track duration = 0;
    @track isPlaying = false;
    @track playbackSpeed = 1;
    @track autoScroll = true;
    @track currentEntryIndex = -1;

    audioElement;
    recordingStartTime;

    renderedCallback() {
        if (!this.audioElement) {
            this.audioElement = this.template.querySelector('audio');
        }
    }

    /**
     * Process documents to identify recordings and pair with transcripts
     */
    processDocuments() {
        log.group('Processing Documents');
        log.time('documentProcessing');

        if (!this._documents || this._documents.length === 0) {
            log.info('No documents to process');
            this.isLoadingRecordings = false;
            this.isLoadingTranscript = false;
            log.groupEnd();
            return;
        }

        // Get all documents from the internal array
        const allDocs = [...this._documents];
        log.debug('Documents received', { count: allDocs.length, documents: allDocs });
        
        // Separate audio files
        const audioFiles = allDocs.filter(doc => {
            const ft = (doc.fileType || '').toUpperCase();
            return ft === 'MP3' || ft === 'WAV' || ft === 'M4A';
        });
        
        // Find specific transcripts by looking for va_ and rt_ prefixes
        let vaTranscript = null;
        let rtTranscript = null;
        
        for (const doc of allDocs) {
            const title = (doc.title || '').toLowerCase();
            if (title.startsWith('va_') || title.includes('va_transcript')) {
                vaTranscript = doc;
            } else if (title.startsWith('rt_') || title.includes('rt_transcript')) {
                rtTranscript = doc;
            }
        }

        // Build recordings array with matched transcripts
        this.recordings = audioFiles.map((audio) => {
            const audioTitle = (audio.title || '').toLowerCase();
            
            // Determine recording type and matching transcript based on filename pattern
            let type = 'call';
            let label = 'Recording';
            let icon = '🎙️';
            let matchedTranscript = null;
            
            if (audioTitle.includes('_2')) {
                // Agent/Real-time recording -> matches rt_transcript
                type = 'agent';
                label = 'Agent Call';
                icon = '👤';
                matchedTranscript = rtTranscript;
            } else {
                // Primary recording -> matches va_transcript
                matchedTranscript = vaTranscript;
                if (matchedTranscript) {
                    type = 'virtual_agent';
                    label = 'Virtual Agent';
                    icon = '🤖';
                }
            }
            
            return {
                id: audio.documentId,
                audioUrl: audio.downloadUrl,
                audioTitle: audio.title,
                type: type,
                label: label,
                icon: icon,
                transcriptDoc: matchedTranscript,
                durationDisplay: '--:--',
                isActive: false,
                pillClass: 'recording-pill'
            };
        });

        // Sort: Virtual Agent first, then Agent, then generic
        this.recordings.sort((a, b) => {
            const order = { 'virtual_agent': 0, 'agent': 1, 'call': 2 };
            return order[a.type] - order[b.type];
        });

        // Update labels with recording numbers if multiple
        if (this.recordings.length > 1) {
            this.recordings = this.recordings.map((rec, idx) => ({
                ...rec,
                label: `${idx + 1}. ${rec.label}`
            }));
        }

        // Mark recordings as loaded
        this.isLoadingRecordings = false;

        log.timeEnd('documentProcessing');
        log.table('Recordings Found', this.recordings.map(r => ({
            type: r.type,
            label: r.label,
            hasTranscript: !!r.transcriptDoc
        })));

        // Select first recording by default
        if (this.recordings.length > 0) {
            log.info('Auto-selecting first recording', { id: this.recordings[0].id });
            this.selectRecording(this.recordings[0].id);
        } else {
            log.warn('No audio recordings found in documents');
            this.isLoadingTranscript = false;
        }
        
        log.groupEnd();
    }

    /**
     * Select a recording to play
     */
    selectRecording(recordingId) {
        // Stop current playback
        if (this.audioElement && this.isPlaying) {
            this.audioElement.pause();
            this.isPlaying = false;
        }

        this.selectedRecordingId = recordingId;
        this.currentTime = 0;
        this.duration = 0;
        this.currentEntryIndex = -1;
        this.transcriptEntries = [];
        
        // Update pill classes
        this.recordings = this.recordings.map(rec => ({
            ...rec,
            isActive: rec.id === recordingId,
            pillClass: rec.id === recordingId ? 'recording-pill active' : 'recording-pill'
        }));

        // Load transcript for selected recording
        const selectedRec = this.recordings.find(r => r.id === recordingId);
        if (selectedRec && selectedRec.transcriptDoc) {
            this.loadTranscript(selectedRec.transcriptDoc.documentId);
        } else {
            this.isLoadingTranscript = false;
        }

        // Update audio source
        if (this.audioElement && selectedRec) {
            this.audioElement.src = selectedRec.audioUrl;
            this.audioElement.load();
        }
    }

    /**
     * Handle recording pill click
     */
    handleRecordingSelect(event) {
        const recordingId = event.currentTarget.dataset.id;
        this.selectRecording(recordingId);
    }

    /**
     * Load and parse transcript from Salesforce
     */
    async loadTranscript(documentId) {
        this.isLoadingTranscript = true;
        log.group('Loading Transcript');
        log.time('transcriptLoad');
        log.debug('Fetching transcript', { documentId });
        
        try {
            const content = await getTranscriptContent({ documentId });

            if (content) {
                log.debug('Transcript content received', { length: content.length });
                this.recordingStartTime = this.extractStartTime(content);
                log.debug('Extracted start time', { startTime: this.recordingStartTime });
                
                const entries = await parseTranscript({ 
                    transcriptContent: content,
                    recordingStartTime: this.recordingStartTime
                });

                this.transcriptEntries = entries.map(entry => ({
                    ...entry,
                    displayTime: this.formatTimeFromSeconds(entry.seconds),
                    entryClass: this.getEntryClass(entry.entryIndex, false),
                    speakerClass: this.getSpeakerClass(entry.speaker)
                }));

                log.success('Transcript parsed', { entryCount: this.transcriptEntries.length });
            } else {
                log.warn('Transcript content is empty');
            }
        } catch (err) {
            log.error('Failed to load transcript', err);
            this.transcriptEntries = [];
        } finally {
            log.timeEnd('transcriptLoad');
            log.groupEnd();
            this.isLoadingTranscript = false;
        }
    }

    /**
     * Extract start time from transcript content
     */
    extractStartTime(content) {
        const match = content.match(/\[(\d{2}:\d{2}:\d{2})/);
        return match ? match[1] : '00:00:00';
    }

    /**
     * Format seconds to MM:SS display
     */
    formatTimeFromSeconds(totalSeconds) {
        if (totalSeconds === null || totalSeconds === undefined || totalSeconds < 0) return '0:00';
        const mins = Math.floor(totalSeconds / 60);
        const secs = Math.floor(totalSeconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Get CSS class for transcript entry based on active state
     */
    getEntryClass(index, isActive) {
        let baseClass = 'transcript-entry';
        if (isActive) {
            baseClass += ' active-entry';
        }
        return baseClass;
    }

    /**
     * Get speaker-specific CSS class
     */
    getSpeakerClass(speaker) {
        const speakerLower = (speaker || '').toLowerCase();
        if (speakerLower.includes('virtual agent') || speakerLower.includes('bot')) {
            return 'entry-speaker speaker-bot';
        }
        if (speakerLower.includes('customer') || speakerLower.includes('caller')) {
            return 'entry-speaker speaker-customer';
        }
        return 'entry-speaker speaker-agent';
    }

    /**
     * Update active transcript entry based on current audio time
     */
    updateActiveEntry() {
        if (!this.transcriptEntries || this.transcriptEntries.length === 0) {
            return;
        }

        let newActiveIndex = -1;
        
        for (let i = 0; i < this.transcriptEntries.length; i++) {
            const entry = this.transcriptEntries[i];
            const nextEntry = this.transcriptEntries[i + 1];
            const entrySeconds = entry.seconds;
            const nextSeconds = nextEntry ? nextEntry.seconds : Infinity;
            
            if (this.currentTime >= entrySeconds && this.currentTime < nextSeconds) {
                newActiveIndex = i;
                break;
            }
        }

        if (newActiveIndex !== this.currentEntryIndex) {
            this.currentEntryIndex = newActiveIndex;
            
            this.transcriptEntries = this.transcriptEntries.map((entry, index) => ({
                ...entry,
                entryClass: this.getEntryClass(entry.entryIndex, index === newActiveIndex)
            }));

            if (this.autoScroll && newActiveIndex >= 0) {
                this.scrollToEntry(newActiveIndex);
            }
        }
    }

    /**
     * Scroll transcript container to show the active entry
     */
    scrollToEntry(index) {
        const container = this.template.querySelector('[data-id="transcriptContainer"]');
        const entries = this.template.querySelectorAll('.transcript-entry');
        
        if (container && entries && entries[index]) {
            const entry = entries[index];
            const containerRect = container.getBoundingClientRect();
            const entryRect = entry.getBoundingClientRect();
            
            if (entryRect.top < containerRect.top || entryRect.bottom > containerRect.bottom) {
                entry.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }
    }

    // Audio event handlers
    handleTimeUpdate() {
        if (this.audioElement) {
            this.currentTime = this.audioElement.currentTime;
            this.updateActiveEntry();
            
            this.dispatchEvent(new CustomEvent('playbackupdate', {
                detail: {
                    sessionId: this.sessionId,
                    currentTime: this.currentTime,
                    isPlaying: this.isPlaying
                }
            }));
        }
    }

    handleLoadedMetadata() {
        if (this.audioElement) {
            this.duration = this.audioElement.duration;
            
            // Update the recording's duration display
            const durationDisplay = this.formatTimeFromSeconds(this.duration);
            this.recordings = this.recordings.map(rec => {
                if (rec.id === this.selectedRecordingId) {
                    return { ...rec, durationDisplay };
                }
                return rec;
            });
        }
    }

    handleAudioEnded() {
        this.isPlaying = false;
        
        // Auto-advance to next recording if available
        const currentIndex = this.recordings.findIndex(r => r.id === this.selectedRecordingId);
        if (currentIndex < this.recordings.length - 1) {
            // Optionally auto-play next recording
            // this.selectRecording(this.recordings[currentIndex + 1].id);
        }
    }

    handleAudioError(_event) {
        // Audio error handled silently - user will see playback issues naturally
    }

    // Playback controls
    handlePlayPause() {
        if (!this.audioElement) return;

        if (this.isPlaying) {
            this.audioElement.pause();
        } else {
            this.audioElement.play();
        }
        this.isPlaying = !this.isPlaying;
    }

    handleSkipBack() {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.max(0, this.audioElement.currentTime - 10);
        }
    }

    handleSkipForward() {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.min(this.duration, this.audioElement.currentTime + 10);
        }
    }

    handleSpeedChange(event) {
        const speed = parseFloat(event.target.dataset.speed);
        this.playbackSpeed = speed;
        
        if (this.audioElement) {
            this.audioElement.playbackRate = speed;
        }
    }

    handleProgressClick(event) {
        const progressWrapper = this.template.querySelector('.progress-bar-wrapper');
        if (!progressWrapper || !this.audioElement) return;

        const rect = progressWrapper.getBoundingClientRect();
        const clickPosition = (event.clientX - rect.left) / rect.width;
        const newTime = clickPosition * this.duration;
        
        this.audioElement.currentTime = Math.max(0, Math.min(this.duration, newTime));
    }

    handleTranscriptClick(event) {
        const entryElement = event.currentTarget;
        const seconds = parseFloat(entryElement.dataset.seconds);
        
        if (this.audioElement && !isNaN(seconds)) {
            this.audioElement.currentTime = seconds;
            
            if (!this.isPlaying) {
                this.audioElement.play();
                this.isPlaying = true;
            }
        }
    }

    handleToggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
    }

    handleDownloadTranscript() {
        const selectedRec = this.recordings.find(r => r.id === this.selectedRecordingId);
        if (selectedRec && selectedRec.transcriptDoc && selectedRec.transcriptDoc.downloadUrl) {
            window.open(selectedRec.transcriptDoc.downloadUrl, '_blank');
        }
    }

    // Computed properties
    get hasRecordings() {
        return !this.isLoadingRecordings && this.recordings.length > 0;
    }

    get noRecordingsAvailable() {
        return !this.isLoadingRecordings && this.recordings.length === 0;
    }

    get hasMultipleRecordings() {
        return this.recordings.length > 1;
    }

    get recordingCountLabel() {
        return `${this.recordings.length} Recordings`;
    }

    get currentRecordingTitle() {
        const rec = this.recordings.find(r => r.id === this.selectedRecordingId);
        return rec ? `${rec.icon} ${rec.label}` : 'Call Recording';
    }

    get currentAudioUrl() {
        const rec = this.recordings.find(r => r.id === this.selectedRecordingId);
        return rec ? rec.audioUrl : this.audioUrl;
    }

    get playPauseIcon() {
        return this.isPlaying ? 'utility:pause' : 'utility:play';
    }

    get playPauseLabel() {
        return this.isPlaying ? 'Pause' : 'Play';
    }

    get currentTimeDisplay() {
        return this.formatTimeFromSeconds(this.currentTime);
    }

    get durationDisplay() {
        return this.formatTimeFromSeconds(this.duration);
    }

    get progressStyle() {
        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        return `width: ${progress}%`;
    }

    get handleStyle() {
        const progress = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;
        return `left: ${progress}%`;
    }

    get speed05Variant() {
        return this.playbackSpeed === 0.5 ? 'brand' : 'neutral';
    }

    get speed1Variant() {
        return this.playbackSpeed === 1 ? 'brand' : 'neutral';
    }

    get speed15Variant() {
        return this.playbackSpeed === 1.5 ? 'brand' : 'neutral';
    }

    get speed2Variant() {
        return this.playbackSpeed === 2 ? 'brand' : 'neutral';
    }

    get autoScrollIcon() {
        return this.autoScroll ? 'utility:lock' : 'utility:unlock';
    }

    get autoScrollTitle() {
        return this.autoScroll ? 'Auto-scroll enabled (click to disable)' : 'Auto-scroll disabled (click to enable)';
    }

    get autoScrollVariant() {
        return this.autoScroll ? 'brand' : 'neutral';
    }

    get hasTranscript() {
        return !this.isLoadingTranscript && this.transcriptEntries && this.transcriptEntries.length > 0;
    }

    get noTranscriptAvailable() {
        return !this.isLoadingTranscript && (!this.transcriptEntries || this.transcriptEntries.length === 0);
    }
}
