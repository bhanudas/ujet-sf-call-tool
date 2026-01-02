import { createElement } from 'lwc';
import CallTranscriptPlayer from 'c/callTranscriptPlayer';
import getTranscriptContent from '@salesforce/apex/VoicecallSessionController.getTranscriptContent';
import parseTranscript from '@salesforce/apex/VoicecallSessionController.parseTranscript';

// Mock HTMLMediaElement methods
window.HTMLMediaElement.prototype.load = jest.fn();
window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
window.HTMLMediaElement.prototype.pause = jest.fn();

// Mock the Apex methods
jest.mock(
    '@salesforce/apex/VoicecallSessionController.getTranscriptContent',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

jest.mock(
    '@salesforce/apex/VoicecallSessionController.parseTranscript',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

describe('c-call-transcript-player', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    const flushPromises = () => new Promise(process.nextTick);

    const mockDocuments = [
        {
            documentId: 'doc1',
            title: 'call_recording.mp3',
            fileType: 'MP3',
            downloadUrl: '/download/audio1'
        },
        {
            documentId: 'doc2',
            title: 'va_transcript_123.txt',
            fileType: 'TXT',
            downloadUrl: '/download/transcript1'
        }
    ];

    const mockTranscriptEntries = [
        {
            timestamp: '10:00:00',
            seconds: 0,
            speaker: 'Virtual Agent',
            text: 'Hello, how can I help?',
            entryIndex: 0
        },
        {
            timestamp: '10:00:15',
            seconds: 15,
            speaker: 'Customer',
            text: 'I have a question.',
            entryIndex: 1
        }
    ];

    describe('initial state', () => {
        it('creates component successfully', () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            expect(element).not.toBeNull();
        });

        it('sets sessionId from api property', () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            expect(element.sessionId).toBe('session123');
        });

        it('sets audioUrl from api property', () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.audioUrl = '/test/audio.mp3';
            document.body.appendChild(element);

            expect(element.audioUrl).toBe('/test/audio.mp3');
        });
    });

    describe('documents processing', () => {
        it('processes documents when set', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            getTranscriptContent.mockResolvedValue('[10:00:00     Agent]     Hello');
            parseTranscript.mockResolvedValue(mockTranscriptEntries);

            element.documents = mockDocuments;

            await flushPromises();

            expect(element.documents).toEqual(mockDocuments);
        });

        it('handles empty documents array', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            element.documents = [];

            await flushPromises();

            expect(element.documents).toEqual([]);
        });

        it('handles null documents by converting to empty array', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            element.documents = null;

            await flushPromises();

            expect(element.documents).toEqual([]);
        });

        it('calls getTranscriptContent when documents have transcript', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            getTranscriptContent.mockResolvedValue('[10:00:00     Agent]     Hello');
            parseTranscript.mockResolvedValue(mockTranscriptEntries);

            element.documents = mockDocuments;

            await flushPromises();

            expect(getTranscriptContent).toHaveBeenCalledWith({ documentId: 'doc2' });
        });

        it('calls parseTranscript with correct parameters', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            const content = '[10:30:00     Agent]     Hello there';
            getTranscriptContent.mockResolvedValue(content);
            parseTranscript.mockResolvedValue(mockTranscriptEntries);

            element.documents = mockDocuments;

            await flushPromises();

            expect(parseTranscript).toHaveBeenCalledWith({
                transcriptContent: content,
                recordingStartTime: '10:30:00'
            });
        });
    });

    describe('extractStartTime behavior', () => {
        it('extracts time from transcript content correctly', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            const content = 'Call ID: 123\n---\n[10:30:45     Agent]     Hello';
            getTranscriptContent.mockResolvedValue(content);
            parseTranscript.mockResolvedValue(mockTranscriptEntries);

            element.documents = mockDocuments;

            await flushPromises();

            expect(parseTranscript).toHaveBeenCalledWith(
                expect.objectContaining({
                    recordingStartTime: '10:30:45'
                })
            );
        });

        it('uses 00:00:00 when no timestamp in content', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            const content = 'No timestamp here';
            getTranscriptContent.mockResolvedValue(content);
            parseTranscript.mockResolvedValue([]);

            element.documents = mockDocuments;

            await flushPromises();

            expect(parseTranscript).toHaveBeenCalledWith(
                expect.objectContaining({
                    recordingStartTime: '00:00:00'
                })
            );
        });
    });

    describe('error handling', () => {
        it('handles transcript loading error gracefully', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            element.sessionId = 'session123';
            document.body.appendChild(element);

            getTranscriptContent.mockRejectedValue(new Error('Network error'));

            element.documents = mockDocuments;

            await flushPromises();

            // Component should not throw - verify it still renders
            const container = element.shadowRoot.querySelector('.player-container');
            expect(container).not.toBeNull();
        });
    });

    describe('DOM rendering', () => {
        it('renders audio element', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const audio = element.shadowRoot.querySelector('audio');
            expect(audio).not.toBeNull();
        });

        it('renders player container', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const container = element.shadowRoot.querySelector('.player-container');
            expect(container).not.toBeNull();
        });

        it('renders audio section', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const audioSection = element.shadowRoot.querySelector('.audio-section');
            expect(audioSection).not.toBeNull();
        });

        it('renders transcript section', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const transcriptSection = element.shadowRoot.querySelector('.transcript-section');
            expect(transcriptSection).not.toBeNull();
        });

        it('renders progress bar wrapper', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const progressWrapper = element.shadowRoot.querySelector('.progress-bar-wrapper');
            expect(progressWrapper).not.toBeNull();
        });

        it('renders progress bar', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const progressBar = element.shadowRoot.querySelector('.progress-bar');
            expect(progressBar).not.toBeNull();
        });

        it('renders progress fill element', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const progressFill = element.shadowRoot.querySelector('.progress-fill');
            expect(progressFill).not.toBeNull();
        });

        it('renders time display', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const timeDisplay = element.shadowRoot.querySelector('.time-display');
            expect(timeDisplay).not.toBeNull();
        });

        it('renders current time span with 0:00', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const currentTime = element.shadowRoot.querySelector('.current-time');
            expect(currentTime).not.toBeNull();
            expect(currentTime.textContent).toBe('0:00');
        });

        it('renders duration span with 0:00', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const duration = element.shadowRoot.querySelector('.duration');
            expect(duration).not.toBeNull();
            expect(duration.textContent).toBe('0:00');
        });

        it('renders speed control section', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const speedControl = element.shadowRoot.querySelector('.speed-control');
            expect(speedControl).not.toBeNull();
        });

        it('renders audio title', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const audioTitle = element.shadowRoot.querySelector('.audio-title');
            expect(audioTitle).not.toBeNull();
        });

        it('renders transcript title', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const transcriptTitle = element.shadowRoot.querySelector('.transcript-title');
            expect(transcriptTitle).not.toBeNull();
        });

        it('renders transcript header', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const transcriptHeader = element.shadowRoot.querySelector('.transcript-header');
            expect(transcriptHeader).not.toBeNull();
        });

        it('renders playback controls section', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const playbackControls = element.shadowRoot.querySelector('.playback-controls');
            expect(playbackControls).not.toBeNull();
        });

        it('renders audio header', async () => {
            const element = createElement('c-call-transcript-player', {
                is: CallTranscriptPlayer
            });
            document.body.appendChild(element);

            await flushPromises();

            const audioHeader = element.shadowRoot.querySelector('.audio-header');
            expect(audioHeader).not.toBeNull();
        });
    });
});
