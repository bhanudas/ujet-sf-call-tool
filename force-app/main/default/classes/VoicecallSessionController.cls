/**
 * Controller for the Voicecall Session Player LWC
 * Retrieves UJET Session records and their associated ContentDocuments
 * for audio recordings and transcripts related to a Case
 */
public with sharing class VoicecallSessionController {
    
    /**
     * Wrapper class to hold call session data with its documents
     */
    public class CallSessionWrapper {
        @AuraEnabled public String sessionId { get; set; }
        @AuraEnabled public String sessionName { get; set; }
        @AuraEnabled public Datetime createdDate { get; set; }
        @AuraEnabled public Decimal duration { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String agentName { get; set; }
        @AuraEnabled public String callType { get; set; }
        @AuraEnabled public String callId { get; set; }
        @AuraEnabled public List<DocumentWrapper> documents { get; set; }
        @AuraEnabled public String audioUrl { get; set; }
        @AuraEnabled public String transcriptContent { get; set; }
        @AuraEnabled public List<TranscriptEntry> parsedTranscript { get; set; }
    }
    
    /**
     * Wrapper class for ContentDocument information
     */
    public class DocumentWrapper {
        @AuraEnabled public String documentId { get; set; }
        @AuraEnabled public String title { get; set; }
        @AuraEnabled public String fileType { get; set; }
        @AuraEnabled public String contentType { get; set; }
        @AuraEnabled public Integer contentSize { get; set; }
        @AuraEnabled public String latestVersionId { get; set; }
        @AuraEnabled public String downloadUrl { get; set; }
    }
    
    /**
     * Wrapper class for parsed transcript entries with timing
     */
    public class TranscriptEntry {
        @AuraEnabled public String timestamp { get; set; }
        @AuraEnabled public Decimal seconds { get; set; }
        @AuraEnabled public String speaker { get; set; }
        @AuraEnabled public String text { get; set; }
        @AuraEnabled public Integer entryIndex { get; set; }
    }
    
    /**
     * Get all UJET Session records related to a Case with their documents
     * @param caseId The Case record Id
     * @return List of CallSessionWrapper objects
     */
    @AuraEnabled(cacheable=true)
    public static List<CallSessionWrapper> getVoicecallSessions(String caseId) {
        List<CallSessionWrapper> sessions = new List<CallSessionWrapper>();
        
        // Query UJET Session records related to the Case
        List<UJET__UJET_Session__c> ujetSessions = [
            SELECT Id, 
                   Name,
                   CreatedDate,
                   UJET__Call_Duration__c,
                   UJET__Session_Type__c,
                   UJET__Status__c,
                   UJET__Call_Id__c,
                   OwnerId,
                   Owner.Name,
                   UJET__Case__c,
                   (SELECT ContentDocumentId 
                    FROM ContentDocumentLinks)
            FROM UJET__UJET_Session__c
            WHERE UJET__Case__c = :caseId
            ORDER BY CreatedDate DESC
        ];
        
        // Collect all ContentDocumentIds
        Set<Id> documentIds = new Set<Id>();
        for (UJET__UJET_Session__c session : ujetSessions) {
            for (ContentDocumentLink cdl : session.ContentDocumentLinks) {
                documentIds.add(cdl.ContentDocumentId);
            }
        }
        
        // Query ContentDocuments with their latest versions
        Map<Id, ContentDocument> documentMap = new Map<Id, ContentDocument>();
        if (!documentIds.isEmpty()) {
            documentMap = new Map<Id, ContentDocument>([
                SELECT Id, 
                       Title, 
                       FileType, 
                       ContentSize,
                       LatestPublishedVersionId
                FROM ContentDocument
                WHERE Id IN :documentIds
            ]);
        }
        
        // Build wrapper objects
        for (UJET__UJET_Session__c session : ujetSessions) {
            CallSessionWrapper wrapper = new CallSessionWrapper();
            wrapper.sessionId = session.Id;
            wrapper.sessionName = session.Name;
            wrapper.createdDate = session.CreatedDate;
            wrapper.duration = session.UJET__Call_Duration__c;
            wrapper.callType = session.UJET__Session_Type__c;
            wrapper.status = session.UJET__Status__c;
            wrapper.callId = session.UJET__Call_Id__c != null ? String.valueOf(session.UJET__Call_Id__c.intValue()) : null;
            wrapper.agentName = session.Owner.Name;
            wrapper.documents = new List<DocumentWrapper>();
            
            // Process associated documents
            for (ContentDocumentLink cdl : session.ContentDocumentLinks) {
                ContentDocument doc = documentMap.get(cdl.ContentDocumentId);
                if (doc != null) {
                    DocumentWrapper docWrapper = new DocumentWrapper();
                    docWrapper.documentId = doc.Id;
                    docWrapper.title = doc.Title;
                    docWrapper.fileType = doc.FileType;
                    docWrapper.contentSize = doc.ContentSize;
                    docWrapper.latestVersionId = doc.LatestPublishedVersionId;
                    docWrapper.downloadUrl = '/sfc/servlet.shepherd/version/download/' + doc.LatestPublishedVersionId;
                    
                    wrapper.documents.add(docWrapper);
                    
                    // Identify audio file (prefer the main recording, not the _2 version)
                    if ((doc.FileType == 'MP3' || doc.FileType == 'WAV' || doc.FileType == 'M4A') 
                        && !doc.Title.contains('_2')) {
                        wrapper.audioUrl = docWrapper.downloadUrl;
                    }
                }
            }
            
            // If no primary audio found, use any audio file
            if (wrapper.audioUrl == null) {
                for (DocumentWrapper docWrapper : wrapper.documents) {
                    if (docWrapper.fileType == 'MP3' || docWrapper.fileType == 'WAV' || docWrapper.fileType == 'M4A') {
                        wrapper.audioUrl = docWrapper.downloadUrl;
                        break;
                    }
                }
            }
            
            sessions.add(wrapper);
        }
        
        return sessions;
    }
    
    /**
     * Get transcript content by ContentDocument Id
     * @param documentId The ContentDocument Id
     * @return The transcript text content
     */
    @AuraEnabled
    public static String getTranscriptContent(String documentId) {
        try {
            ContentVersion cv = [
                SELECT VersionData
                FROM ContentVersion
                WHERE ContentDocumentId = :documentId
                AND IsLatest = true
                LIMIT 1
            ];
            
            return cv.VersionData.toString();
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving transcript: ' + e.getMessage());
        }
    }
    
    /**
     * Parse transcript content into structured entries with timing
     * @param transcriptContent The raw transcript text
     * @param recordingStartTime The time the recording started (from call metadata)
     * @return List of TranscriptEntry objects with calculated seconds
     */
    @AuraEnabled
    public static List<TranscriptEntry> parseTranscript(String transcriptContent, String recordingStartTime) {
        List<TranscriptEntry> entries = new List<TranscriptEntry>();
        
        if (String.isBlank(transcriptContent)) {
            return entries;
        }
        
        // Parse recording start time (format: HH:MM:SS)
        Integer startSeconds = 0;
        if (String.isNotBlank(recordingStartTime)) {
            startSeconds = parseTimeToSeconds(recordingStartTime);
        }
        
        // Split transcript into lines
        List<String> lines = transcriptContent.split('\n');
        
        Integer entryIndex = 0;
        TranscriptEntry currentEntry = null;
        
        for (String line : lines) {
            // Skip header lines and separators
            if (line.startsWith('Call ID:') || line.startsWith('---') || String.isBlank(line.trim())) {
                continue;
            }
            
            // Pattern: [HH:MM:SS     Speaker Name]     Text
            // Check if line starts with timestamp pattern
            Pattern timestampPattern = Pattern.compile('\\[(\\d{2}:\\d{2}:\\d{2})\\s+(.+?)\\]\\s*(.*)');
            Matcher matcher = timestampPattern.matcher(line.trim());
            
            if (matcher.find()) {
                // New entry with timestamp
                if (currentEntry != null) {
                    entries.add(currentEntry);
                }
                
                currentEntry = new TranscriptEntry();
                currentEntry.timestamp = matcher.group(1);
                currentEntry.speaker = matcher.group(2).trim();
                currentEntry.text = matcher.group(3).trim();
                currentEntry.entryIndex = entryIndex++;
                
                // Calculate seconds from start
                Integer entrySeconds = parseTimeToSeconds(currentEntry.timestamp);
                currentEntry.seconds = entrySeconds - startSeconds;
                
                // Handle case where recording starts after call (negative times become 0)
                if (currentEntry.seconds < 0) {
                    currentEntry.seconds = 0;
                }
            } else if (currentEntry != null && line.trim().length() > 0) {
                // Continuation of previous entry
                currentEntry.text += ' ' + line.trim();
            }
        }
        
        // Add last entry
        if (currentEntry != null) {
            entries.add(currentEntry);
        }
        
        return entries;
    }
    
    /**
     * Helper method to convert HH:MM:SS to total seconds
     */
    private static Integer parseTimeToSeconds(String timeStr) {
        if (String.isBlank(timeStr)) return 0;
        
        List<String> parts = timeStr.split(':');
        if (parts.size() != 3) return 0;
        
        try {
            Integer hours = Integer.valueOf(parts[0]);
            Integer minutes = Integer.valueOf(parts[1]);
            Integer seconds = Integer.valueOf(parts[2]);
            
            return (hours * 3600) + (minutes * 60) + seconds;
        } catch (Exception e) {
            return 0;
        }
    }
}
