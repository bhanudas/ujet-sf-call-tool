import { LightningElement, api, wire, track } from 'lwc';
import getVoicecallSessions from '@salesforce/apex/VoicecallSessionController.getVoicecallSessions';
import Logger from 'c/loggerService';

// Initialize component logger
const log = Logger.create('VoicecallSessionPlayer');

export default class VoicecallSessionPlayer extends LightningElement {
    @api recordId; // Case record Id from the record page

    @track sessions = [];
    @track error;
    @track isLoading = true;
    @track activeSections = [];

    /**
     * Wire adapter to fetch voicecall sessions for the current case
     */
    @wire(getVoicecallSessions, { caseId: '$recordId' })
    wiredSessions({ error, data }) {
        this.isLoading = false;
        log.lifecycle('wire', { caseId: this.recordId });
        
        if (data) {
            log.apex('getVoicecallSessions', { caseId: this.recordId }, data);
            this.sessions = this.processSessionData(data);
            this.error = undefined;
            
            log.success(`Loaded ${this.sessions.length} session(s)`);
            
            // Auto-expand first session if there's only one
            if (this.sessions.length === 1) {
                this.activeSections = [this.sessions[0].sessionId];
                log.debug('Auto-expanded single session');
            }
        } else if (error) {
            log.error('Failed to load sessions', error);
            this.error = error;
            this.sessions = [];
        }
    }

    /**
     * Process and enrich session data for display
     */
    processSessionData(rawSessions) {
        return rawSessions.map((session, index) => {
            const formattedDate = this.formatDate(session.createdDate);
            const formattedDuration = this.formatDuration(session.duration);
            
            return {
                ...session,
                formattedDate,
                formattedDuration,
                accordionLabel: `Call ${index + 1} - ${formattedDate} (${formattedDuration})`,
                agentName: session.agentName || 'Unknown Agent',
                callType: session.callType || 'Voice Call'
            };
        });
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    }

    /**
     * Format duration in seconds to MM:SS format
     */
    formatDuration(seconds) {
        if (!seconds && seconds !== 0) return 'N/A';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Computed properties for template logic
     */
    get hasNoCalls() {
        return !this.isLoading && !this.error && this.sessions.length === 0;
    }

    get hasCalls() {
        return !this.isLoading && !this.error && this.sessions.length > 0;
    }

    get errorMessage() {
        if (!this.error) return '';
        
        if (this.error.body && this.error.body.message) {
            return this.error.body.message;
        }
        return 'An error occurred while loading call recordings.';
    }

    /**
     * Handle playback update events from child components
     */
    handlePlaybackUpdate(_event) {
        // Placeholder for analytics or cross-component coordination
        // Access event.detail.sessionId, currentTime, isPlaying as needed
    }
}

