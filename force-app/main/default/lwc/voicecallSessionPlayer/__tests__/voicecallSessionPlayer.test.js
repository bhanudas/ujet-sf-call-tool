import { createElement } from 'lwc';
import VoicecallSessionPlayer from 'c/voicecallSessionPlayer';
import getVoicecallSessions from '@salesforce/apex/VoicecallSessionController.getVoicecallSessions';

// Mock the Apex wire adapter
jest.mock(
    '@salesforce/apex/VoicecallSessionController.getVoicecallSessions',
    () => {
        const { createApexTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');
        return {
            default: createApexTestWireAdapter(jest.fn())
        };
    },
    { virtual: true }
);

describe('c-voicecall-session-player', () => {
    afterEach(() => {
        // Clean up DOM after each test
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    // Helper to wait for promises to resolve
    const flushPromises = () => new Promise(process.nextTick);

    describe('initial state', () => {
        it('renders lightning-card with title', () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            const card = element.shadowRoot.querySelector('lightning-card');
            expect(card).not.toBeNull();
            expect(card.title).toBe('Call Recordings');
        });

        it('sets recordId from api property', () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            expect(element.recordId).toBe('500000000000001AAA');
        });
    });

    describe('with session data', () => {
        const mockSessionData = [
            {
                sessionId: 'a00000000000001AAA',
                sessionName: 'UJET-001',
                createdDate: '2024-01-15T10:30:00.000Z',
                duration: 180,
                status: 'Completed',
                agentName: 'John Agent',
                callType: 'Voice',
                callId: '12345',
                documents: [
                    {
                        documentId: '069000000000001AAA',
                        title: 'call_recording.mp3',
                        fileType: 'MP3',
                        downloadUrl: '/sfc/servlet.shepherd/version/download/068000000000001'
                    }
                ],
                audioUrl: '/sfc/servlet.shepherd/version/download/068000000000001'
            }
        ];

        it('displays sessions when data is loaded', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            // Emit data from the wire adapter
            getVoicecallSessions.emit(mockSessionData);

            await flushPromises();

            // Check that accordion is rendered
            const accordion = element.shadowRoot.querySelector('lightning-accordion');
            expect(accordion).not.toBeNull();
        });

        it('auto-expands single session accordion', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit(mockSessionData);

            await flushPromises();

            const accordion = element.shadowRoot.querySelector('lightning-accordion');
            expect(accordion.activeSectionName).toContain('a00000000000001AAA');
        });

        it('renders accordion section with label containing Call 1', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit(mockSessionData);

            await flushPromises();

            const accordionSection = element.shadowRoot.querySelector('lightning-accordion-section');
            expect(accordionSection).not.toBeNull();
            expect(accordionSection.label).toContain('Call 1');
        });

        it('formats duration as 3:00 for 180 seconds in label', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit(mockSessionData);

            await flushPromises();

            const accordionSection = element.shadowRoot.querySelector('lightning-accordion-section');
            expect(accordionSection.label).toContain('3:00');
        });

        it('renders call metadata section', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit(mockSessionData);

            await flushPromises();

            const metadata = element.shadowRoot.querySelector('.call-metadata');
            expect(metadata).not.toBeNull();
        });

        it('renders c-call-transcript-player child component', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit(mockSessionData);

            await flushPromises();

            const transcriptPlayer = element.shadowRoot.querySelector('c-call-transcript-player');
            expect(transcriptPlayer).not.toBeNull();
        });
    });

    describe('with no sessions', () => {
        it('does not render accordion when empty', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit([]);

            await flushPromises();

            const accordion = element.shadowRoot.querySelector('lightning-accordion');
            expect(accordion).toBeNull();
        });

        it('renders no calls illustration', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit([]);

            await flushPromises();

            const illustration = element.shadowRoot.querySelector('.slds-illustration');
            expect(illustration).not.toBeNull();
        });
    });

    describe('with error', () => {
        it('renders error alert on wire error', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.error({
                body: { message: 'Test error message' }
            });

            await flushPromises();

            const errorAlert = element.shadowRoot.querySelector('.slds-notify_alert');
            expect(errorAlert).not.toBeNull();
        });

        it('displays error message in alert', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.error({
                body: { message: 'Test error message' }
            });

            await flushPromises();

            const errorH2 = element.shadowRoot.querySelector('.slds-notify_alert h2');
            // Error message is displayed
            expect(errorH2).not.toBeNull();
            expect(errorH2.textContent.length).toBeGreaterThan(0);
        });

        it('shows generic error when no body.message', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.error({});

            await flushPromises();

            const errorH2 = element.shadowRoot.querySelector('.slds-notify_alert h2');
            expect(errorH2.textContent).toBe('An error occurred while loading call recordings.');
        });
    });

    describe('formatDate method', () => {
        it('shows N/A for null date in label', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'test',
                    createdDate: null,
                    duration: 60,
                    documents: []
                }
            ]);

            await flushPromises();

            const section = element.shadowRoot.querySelector('lightning-accordion-section');
            expect(section.label).toContain('N/A');
        });
    });

    describe('formatDuration method', () => {
        it('shows N/A for null duration in label', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'test',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: null,
                    documents: []
                }
            ]);

            await flushPromises();

            const section = element.shadowRoot.querySelector('lightning-accordion-section');
            expect(section.label).toContain('N/A');
        });

        it('shows 0:00 for zero duration in label', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'test',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: 0,
                    documents: []
                }
            ]);

            await flushPromises();

            const section = element.shadowRoot.querySelector('lightning-accordion-section');
            expect(section.label).toContain('0:00');
        });

        it('shows 1:30 for 90 seconds duration', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'test',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: 90,
                    documents: []
                }
            ]);

            await flushPromises();

            const section = element.shadowRoot.querySelector('lightning-accordion-section');
            expect(section.label).toContain('1:30');
        });
    });

    describe('multiple sessions', () => {
        it('does not auto-expand accordion with multiple sessions', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'session1',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: 60,
                    documents: []
                },
                {
                    sessionId: 'session2',
                    createdDate: '2024-01-15T11:30:00.000Z',
                    duration: 120,
                    documents: []
                }
            ]);

            await flushPromises();

            const accordion = element.shadowRoot.querySelector('lightning-accordion');
            expect(accordion.activeSectionName).toEqual([]);
        });

        it('renders two accordion sections for two sessions', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'session1',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: 60,
                    documents: []
                },
                {
                    sessionId: 'session2',
                    createdDate: '2024-01-15T11:30:00.000Z',
                    duration: 120,
                    documents: []
                }
            ]);

            await flushPromises();

            const sections = element.shadowRoot.querySelectorAll('lightning-accordion-section');
            expect(sections.length).toBe(2);
        });

        it('numbers sessions correctly as Call 1 and Call 2', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'session1',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: 60,
                    documents: []
                },
                {
                    sessionId: 'session2',
                    createdDate: '2024-01-15T11:30:00.000Z',
                    duration: 120,
                    documents: []
                }
            ]);

            await flushPromises();

            const sections = element.shadowRoot.querySelectorAll('lightning-accordion-section');
            expect(sections[0].label).toContain('Call 1');
            expect(sections[1].label).toContain('Call 2');
        });
    });

    describe('session data enrichment', () => {
        it('uses Unknown Agent when agentName is null', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'test',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: 60,
                    agentName: null,
                    callType: 'Voice',
                    documents: []
                }
            ]);

            await flushPromises();

            const metadataValues = element.shadowRoot.querySelectorAll('.metadata-value');
            const agentValue = Array.from(metadataValues).find(el => 
                el.textContent === 'Unknown Agent'
            );
            expect(agentValue).not.toBeNull();
        });

        it('uses Voice Call when callType is null', async () => {
            const element = createElement('c-voicecall-session-player', {
                is: VoicecallSessionPlayer
            });
            element.recordId = '500000000000001AAA';
            document.body.appendChild(element);

            getVoicecallSessions.emit([
                {
                    sessionId: 'test',
                    createdDate: '2024-01-15T10:30:00.000Z',
                    duration: 60,
                    agentName: 'Test Agent',
                    callType: null,
                    documents: []
                }
            ]);

            await flushPromises();

            const metadataValues = element.shadowRoot.querySelectorAll('.metadata-value');
            const typeValue = Array.from(metadataValues).find(el => 
                el.textContent === 'Voice Call'
            );
            expect(typeValue).not.toBeNull();
        });
    });
});
