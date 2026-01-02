/**
 * Test class for VoicecallSessionController
 * Provides comprehensive test coverage for all controller methods
 */
@isTest
private class VoicecallSessionControllerTest {
    
    /**
     * Test parseTranscript with valid transcript content
     */
    @isTest
    static void testParseTranscript_ValidContent() {
        String transcriptContent = 
            'Call ID: 12345\n' +
            '---\n' +
            '[10:30:00     Virtual Agent]     Hello, how can I help you today?\n' +
            '[10:30:15     Customer]     I have a question about my order.\n' +
            '[10:30:30     Virtual Agent]     Sure, I can help with that.\n';
        
        String recordingStartTime = '10:30:00';
        
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(transcriptContent, recordingStartTime);
        Test.stopTest();
        
        System.assertEquals(3, entries.size(), 'Should parse 3 transcript entries');
        
        // Verify first entry
        System.assertEquals('10:30:00', entries[0].timestamp, 'First entry timestamp should match');
        System.assertEquals('Virtual Agent', entries[0].speaker, 'First entry speaker should be Virtual Agent');
        System.assertEquals('Hello, how can I help you today?', entries[0].text, 'First entry text should match');
        System.assertEquals(0, entries[0].seconds, 'First entry should be at 0 seconds');
        System.assertEquals(0, entries[0].entryIndex, 'First entry index should be 0');
        
        // Verify second entry
        System.assertEquals('10:30:15', entries[1].timestamp, 'Second entry timestamp should match');
        System.assertEquals('Customer', entries[1].speaker, 'Second entry speaker should be Customer');
        System.assertEquals(15, entries[1].seconds, 'Second entry should be at 15 seconds');
        
        // Verify third entry
        System.assertEquals(30, entries[2].seconds, 'Third entry should be at 30 seconds');
    }
    
    /**
     * Test parseTranscript with empty content
     */
    @isTest
    static void testParseTranscript_EmptyContent() {
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript('', '10:00:00');
        Test.stopTest();
        
        System.assertEquals(0, entries.size(), 'Should return empty list for empty content');
    }
    
    /**
     * Test parseTranscript with null content
     */
    @isTest
    static void testParseTranscript_NullContent() {
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(null, '10:00:00');
        Test.stopTest();
        
        System.assertEquals(0, entries.size(), 'Should return empty list for null content');
    }
    
    /**
     * Test parseTranscript with null start time
     */
    @isTest
    static void testParseTranscript_NullStartTime() {
        String transcriptContent = '[10:00:30     Agent]     Hello there.';
        
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(transcriptContent, null);
        Test.stopTest();
        
        System.assertEquals(1, entries.size(), 'Should parse 1 entry');
        // With null start time, seconds should be calculated from midnight
        System.assertEquals(36030, entries[0].seconds, 'Seconds should be from midnight');
    }
    
    /**
     * Test parseTranscript with multi-line text continuation
     */
    @isTest
    static void testParseTranscript_MultiLineText() {
        String transcriptContent = 
            '[10:00:00     Agent]     This is the first line\n' +
            'and this continues on the second line\n' +
            'and even more on the third line.\n' +
            '[10:00:30     Customer]     Got it.';
        
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(transcriptContent, '10:00:00');
        Test.stopTest();
        
        System.assertEquals(2, entries.size(), 'Should parse 2 entries');
        System.assert(entries[0].text.contains('second line'), 'First entry should include continuation text');
        System.assert(entries[0].text.contains('third line'), 'First entry should include all continuation text');
    }
    
    /**
     * Test parseTranscript skips header lines
     */
    @isTest
    static void testParseTranscript_SkipsHeaders() {
        String transcriptContent = 
            'Call ID: 98765\n' +
            '---\n' +
            '\n' +
            '[10:00:00     Agent]     Hello.';
        
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(transcriptContent, '10:00:00');
        Test.stopTest();
        
        System.assertEquals(1, entries.size(), 'Should parse only 1 entry, skipping headers');
        System.assertEquals('Agent', entries[0].speaker, 'Speaker should be Agent');
    }
    
    /**
     * Test parseTranscript with negative time offset (recording starts after call)
     */
    @isTest
    static void testParseTranscript_NegativeOffset() {
        String transcriptContent = '[10:00:00     Agent]     Hello.';
        String recordingStartTime = '10:00:30'; // Recording started 30 seconds after first entry
        
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(transcriptContent, recordingStartTime);
        Test.stopTest();
        
        System.assertEquals(1, entries.size(), 'Should parse 1 entry');
        System.assertEquals(0, entries[0].seconds, 'Negative seconds should become 0');
    }
    
    /**
     * Test getTranscriptContent with valid document
     */
    @isTest
    static void testGetTranscriptContent_ValidDocument() {
        // Create test ContentVersion
        String testContent = 'Test transcript content\n[10:00:00     Agent]     Hello';
        ContentVersion cv = new ContentVersion(
            Title = 'test_transcript',
            PathOnClient = 'test_transcript.txt',
            VersionData = Blob.valueOf(testContent)
        );
        insert cv;
        
        // Get the ContentDocument Id
        ContentVersion insertedCv = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id];
        
        Test.startTest();
        String result = VoicecallSessionController.getTranscriptContent(insertedCv.ContentDocumentId);
        Test.stopTest();
        
        System.assertEquals(testContent, result, 'Should return the transcript content');
    }
    
    /**
     * Test getTranscriptContent with invalid document ID throws exception
     */
    @isTest
    static void testGetTranscriptContent_InvalidDocument() {
        Boolean exceptionThrown = false;
        Test.startTest();
        try {
            VoicecallSessionController.getTranscriptContent('069000000000000AAA');
        } catch (Exception e) {
            exceptionThrown = true;
            // Either AuraHandledException or QueryException is acceptable
            System.assert(
                e instanceof AuraHandledException || e.getMessage() != null,
                'Should throw an exception for invalid document ID'
            );
        }
        Test.stopTest();
        System.assert(exceptionThrown, 'An exception should have been thrown');
    }
    
    /**
     * Test getVoicecallSessions with no sessions
     */
    @isTest
    static void testGetVoicecallSessions_NoSessions() {
        // Create a test Case
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;
        
        Test.startTest();
        List<VoicecallSessionController.CallSessionWrapper> sessions = 
            VoicecallSessionController.getVoicecallSessions(testCase.Id);
        Test.stopTest();
        
        System.assertEquals(0, sessions.size(), 'Should return empty list when no sessions exist');
    }
    
    /**
     * Test getVoicecallSessions with UJET Sessions and documents
     */
    @isTest
    static void testGetVoicecallSessions_WithSessionsAndDocuments() {
        // Create test Case
        Case testCase = new Case(Subject = 'Test Call Case');
        insert testCase;
        
        // Create UJET Session
        UJET__UJET_Session__c session = new UJET__UJET_Session__c(
            UJET__Case__c = testCase.Id,
            UJET__Call_Duration__c = 120,
            UJET__Session_Type__c = 'Voice',
            UJET__Status__c = 'Completed',
            UJET__Call_Id__c = 12345
        );
        insert session;
        
        // Create ContentVersion for audio file
        ContentVersion audioFile = new ContentVersion(
            Title = 'call_recording',
            PathOnClient = 'call_recording.mp3',
            VersionData = Blob.valueOf('fake audio content')
        );
        insert audioFile;
        
        // Get ContentDocument and link to session
        ContentVersion insertedAudio = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :audioFile.Id];
        ContentDocumentLink audioLink = new ContentDocumentLink(
            LinkedEntityId = session.Id,
            ContentDocumentId = insertedAudio.ContentDocumentId,
            ShareType = 'V'
        );
        insert audioLink;
        
        // Create ContentVersion for transcript
        ContentVersion transcriptFile = new ContentVersion(
            Title = 'va_transcript_12345',
            PathOnClient = 'va_transcript_12345.txt',
            VersionData = Blob.valueOf('[10:00:00     Agent]     Hello')
        );
        insert transcriptFile;
        
        // Get ContentDocument and link to session
        ContentVersion insertedTranscript = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :transcriptFile.Id];
        ContentDocumentLink transcriptLink = new ContentDocumentLink(
            LinkedEntityId = session.Id,
            ContentDocumentId = insertedTranscript.ContentDocumentId,
            ShareType = 'V'
        );
        insert transcriptLink;
        
        Test.startTest();
        List<VoicecallSessionController.CallSessionWrapper> sessions = 
            VoicecallSessionController.getVoicecallSessions(testCase.Id);
        Test.stopTest();
        
        System.assertEquals(1, sessions.size(), 'Should return 1 session');
        System.assertEquals(session.Id, sessions[0].sessionId, 'Session ID should match');
        System.assertEquals(120, sessions[0].duration, 'Duration should match');
        System.assertEquals('Voice', sessions[0].callType, 'Call type should match');
        System.assertEquals('Completed', sessions[0].status, 'Status should match');
        System.assertEquals('12345', sessions[0].callId, 'Call ID should match');
        System.assertEquals(2, sessions[0].documents.size(), 'Should have 2 documents');
        System.assertNotEquals(null, sessions[0].audioUrl, 'Should have audio URL');
    }
    
    /**
     * Test getVoicecallSessions with secondary audio file (_2 pattern)
     */
    @isTest
    static void testGetVoicecallSessions_SecondaryAudioFile() {
        // Create test Case
        Case testCase = new Case(Subject = 'Test Call Case');
        insert testCase;
        
        // Create UJET Session
        UJET__UJET_Session__c session = new UJET__UJET_Session__c(
            UJET__Case__c = testCase.Id,
            UJET__Call_Duration__c = 60
        );
        insert session;
        
        // Create only a _2 audio file (secondary recording)
        ContentVersion audioFile = new ContentVersion(
            Title = 'call_recording_2',
            PathOnClient = 'call_recording_2.mp3',
            VersionData = Blob.valueOf('fake audio content')
        );
        insert audioFile;
        
        ContentVersion insertedAudio = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :audioFile.Id];
        ContentDocumentLink audioLink = new ContentDocumentLink(
            LinkedEntityId = session.Id,
            ContentDocumentId = insertedAudio.ContentDocumentId,
            ShareType = 'V'
        );
        insert audioLink;
        
        Test.startTest();
        List<VoicecallSessionController.CallSessionWrapper> sessions = 
            VoicecallSessionController.getVoicecallSessions(testCase.Id);
        Test.stopTest();
        
        System.assertEquals(1, sessions.size(), 'Should return 1 session');
        // The _2 file should not be used as primary, but since it's the only audio, fallback should use it
        System.assertNotEquals(null, sessions[0].audioUrl, 'Should have audio URL from fallback logic');
    }
    
    /**
     * Test getVoicecallSessions with session having null Call_Id
     */
    @isTest
    static void testGetVoicecallSessions_NullCallId() {
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;
        
        UJET__UJET_Session__c session = new UJET__UJET_Session__c(
            UJET__Case__c = testCase.Id,
            UJET__Call_Id__c = null
        );
        insert session;
        
        Test.startTest();
        List<VoicecallSessionController.CallSessionWrapper> sessions = 
            VoicecallSessionController.getVoicecallSessions(testCase.Id);
        Test.stopTest();
        
        System.assertEquals(1, sessions.size(), 'Should return 1 session');
        System.assertEquals(null, sessions[0].callId, 'Call ID should be null');
    }
    
    /**
     * Test wrapper class instantiation and properties
     */
    @isTest
    static void testWrapperClasses() {
        // Test CallSessionWrapper
        VoicecallSessionController.CallSessionWrapper sessionWrapper = 
            new VoicecallSessionController.CallSessionWrapper();
        sessionWrapper.sessionId = 'testId';
        sessionWrapper.sessionName = 'Test Session';
        sessionWrapper.createdDate = Datetime.now();
        sessionWrapper.duration = 100;
        sessionWrapper.status = 'Active';
        sessionWrapper.agentName = 'Test Agent';
        sessionWrapper.callType = 'Voice';
        sessionWrapper.callId = '12345';
        sessionWrapper.documents = new List<VoicecallSessionController.DocumentWrapper>();
        sessionWrapper.audioUrl = '/test/url';
        sessionWrapper.transcriptContent = 'Test content';
        sessionWrapper.parsedTranscript = new List<VoicecallSessionController.TranscriptEntry>();
        
        System.assertEquals('testId', sessionWrapper.sessionId);
        System.assertEquals('Test Session', sessionWrapper.sessionName);
        
        // Test DocumentWrapper
        VoicecallSessionController.DocumentWrapper docWrapper = 
            new VoicecallSessionController.DocumentWrapper();
        docWrapper.documentId = 'docId';
        docWrapper.title = 'Test Doc';
        docWrapper.fileType = 'MP3';
        docWrapper.contentType = 'audio/mpeg';
        docWrapper.contentSize = 1024;
        docWrapper.latestVersionId = 'versionId';
        docWrapper.downloadUrl = '/download/url';
        
        System.assertEquals('docId', docWrapper.documentId);
        System.assertEquals('MP3', docWrapper.fileType);
        
        // Test TranscriptEntry
        VoicecallSessionController.TranscriptEntry entry = 
            new VoicecallSessionController.TranscriptEntry();
        entry.timestamp = '10:00:00';
        entry.seconds = 100;
        entry.speaker = 'Agent';
        entry.text = 'Hello';
        entry.entryIndex = 0;
        
        System.assertEquals('10:00:00', entry.timestamp);
        System.assertEquals(100, entry.seconds);
    }
    
    /**
     * Test parseTranscript with invalid time format
     */
    @isTest
    static void testParseTranscript_InvalidTimeFormat() {
        String transcriptContent = '[10:00:00     Agent]     Hello.';
        String invalidStartTime = 'invalid';
        
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(transcriptContent, invalidStartTime);
        Test.stopTest();
        
        System.assertEquals(1, entries.size(), 'Should still parse the entry');
    }
    
    /**
     * Test parseTranscript with blank start time
     */
    @isTest
    static void testParseTranscript_BlankStartTime() {
        String transcriptContent = '[00:00:30     Agent]     Hello.';
        
        Test.startTest();
        List<VoicecallSessionController.TranscriptEntry> entries = 
            VoicecallSessionController.parseTranscript(transcriptContent, '');
        Test.stopTest();
        
        System.assertEquals(1, entries.size(), 'Should parse 1 entry');
        System.assertEquals(30, entries[0].seconds, 'Seconds should be 30 from midnight');
    }
    
    /**
     * Test getVoicecallSessions with WAV and M4A audio files
     */
    @isTest
    static void testGetVoicecallSessions_OtherAudioFormats() {
        Case testCase = new Case(Subject = 'Test Case');
        insert testCase;
        
        UJET__UJET_Session__c session = new UJET__UJET_Session__c(
            UJET__Case__c = testCase.Id
        );
        insert session;
        
        // Create WAV file
        ContentVersion wavFile = new ContentVersion(
            Title = 'recording',
            PathOnClient = 'recording.wav',
            VersionData = Blob.valueOf('wav content')
        );
        insert wavFile;
        
        ContentVersion insertedWav = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :wavFile.Id];
        insert new ContentDocumentLink(
            LinkedEntityId = session.Id,
            ContentDocumentId = insertedWav.ContentDocumentId,
            ShareType = 'V'
        );
        
        Test.startTest();
        List<VoicecallSessionController.CallSessionWrapper> sessions = 
            VoicecallSessionController.getVoicecallSessions(testCase.Id);
        Test.stopTest();
        
        System.assertEquals(1, sessions.size(), 'Should return 1 session');
        System.assertNotEquals(null, sessions[0].audioUrl, 'Should have audio URL for WAV file');
    }
}

