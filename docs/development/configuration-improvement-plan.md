# Configuration Improvement Plan

## Executive Summary

This document outlines a comprehensive plan to make the UJET Salesforce Call Tool more configurable and resilient. The current implementation contains numerous hardcoded values and fragile pattern-matching logic that could break if Google CCAAS or UJET changes their file naming conventions or transcript formats.

---

## Risk Assessment

### Critical Risk: Google CCAAS File Format Dependencies

The solution has a **high dependency** on Google CCAAS producing files with specific naming patterns and transcript formats. If Google changes any of these conventions, the component will fail silently or produce incorrect behavior.

| Risk Area | Current Implementation | Severity |
|-----------|----------------------|----------|
| Transcript file naming | Hardcoded `va_` and `rt_` prefixes | **HIGH** |
| Audio file naming | Hardcoded `_2` suffix detection | **HIGH** |
| Transcript format | Regex pattern for `[HH:MM:SS Speaker]` | **HIGH** |
| Speaker identification | String matching on speaker names | **MEDIUM** |
| Audio file types | Hardcoded MP3/WAV/M4A | **MEDIUM** |

---

## Priority 1: File Naming Pattern Configuration (HIGH RISK)

### Problem

The code uses hardcoded string matching to identify file types:

**`callTranscriptPlayer.js` (lines 64-75):**
```javascript
// Fragile: depends on Google using exact prefixes
if (title.startsWith('va_') || title.includes('va_transcript')) {
    vaTranscript = doc;
} else if (title.startsWith('rt_') || title.includes('rt_transcript')) {
    rtTranscript = doc;
}
```

**`callTranscriptPlayer.js` (lines 87-100):**
```javascript
// Fragile: depends on Google using "_2" suffix for agent recordings
if (audioTitle.includes('_2')) {
    type = 'agent';
    matchedTranscript = rtTranscript;
} else {
    matchedTranscript = vaTranscript;
}
```

### Recommendation

Create a **Custom Metadata Type** or **Custom Setting** to store file pattern configurations:

**Proposed Metadata Structure:**
```
File_Pattern_Config__mdt
├── Pattern_Name__c (e.g., "VA_Transcript", "RT_Transcript", "Agent_Recording")
├── File_Prefix__c (e.g., "va_", "rt_")
├── File_Suffix__c (e.g., "_2")
├── Contains_Pattern__c (e.g., "va_transcript")
├── Recording_Type__c (e.g., "virtual_agent", "agent")
├── Associated_Transcript_Type__c (references another pattern)
├── Display_Label__c (e.g., "Virtual Agent", "Agent Call")
├── Display_Icon__c (emoji or icon name)
└── Sort_Order__c (numeric priority)
```

**Benefits:**
- Administrators can update patterns without code deployment
- Easy to add new recording/transcript types
- Supports A/B testing different pattern detection strategies
- Audit trail of configuration changes

---

## Priority 2: Transcript Format Parsing (HIGH RISK)

### Problem

The Apex controller has a hardcoded regex pattern for parsing transcripts:

**`VoicecallSessionController.cls` (lines 205-208):**
```apex
// Pattern: [HH:MM:SS     Speaker Name]     Text
Pattern timestampPattern = Pattern.compile('\\[(\\d{2}:\\d{2}:\\d{2})\\s+(.+?)\\]\\s*(.*)');
```

**Additional hardcoded patterns (lines 199-201):**
```apex
// Skip header lines
if (line.startsWith('Call ID:') || line.startsWith('---') || String.isBlank(line.trim())) {
    continue;
}
```

### Recommendation

Create a **Transcript Format Configuration** custom metadata:

**Proposed Metadata Structure:**
```
Transcript_Format_Config__mdt
├── Format_Name__c (e.g., "Google_CCAAS_v1")
├── Is_Active__c (Boolean)
├── Timestamp_Regex__c (the regex pattern)
├── Header_Skip_Patterns__c (comma-separated, e.g., "Call ID:,---")
├── Timestamp_Group__c (regex group number for timestamp)
├── Speaker_Group__c (regex group number for speaker)
├── Text_Group__c (regex group number for text)
├── Time_Format__c (e.g., "HH:MM:SS", "HH:MM:SS.mmm")
└── Description__c
```

**Implementation Considerations:**
- Support multiple active formats for fallback parsing
- Cache compiled patterns for performance
- Log parsing failures for monitoring
- Consider a "strict mode" vs "lenient mode" toggle

---

## Priority 3: Speaker Role Classification (MEDIUM RISK)

### Problem

Speaker roles are determined by substring matching on hardcoded strings:

**`callTranscriptPlayer.js` (lines 249-258):**
```javascript
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
```

### Recommendation

Create a **Speaker Role Configuration**:

**Proposed Metadata Structure:**
```
Speaker_Role_Config__mdt
├── Role_Name__c (e.g., "Bot", "Customer", "Agent")
├── Match_Patterns__c (comma-separated: "virtual agent,bot,ivr,automated")
├── CSS_Class__c (e.g., "speaker-bot")
├── Display_Color__c (hex color for UI)
├── Icon__c (optional emoji or SLDS icon)
├── Priority__c (for conflict resolution)
└── Is_Default__c (fallback role)
```

**Benefits:**
- Support for new speaker types (e.g., "Supervisor", "Quality Monitor")
- Localization of speaker role names
- Easy color/styling customization per org

---

## Priority 4: Audio Format Support (MEDIUM RISK)

### Problem

Supported audio formats are hardcoded in multiple locations:

**`callTranscriptPlayer.js` (lines 59-61):**
```javascript
const ft = (doc.fileType || '').toUpperCase();
return ft === 'MP3' || ft === 'WAV' || ft === 'M4A';
```

**`VoicecallSessionController.cls` (lines 128, 138):**
```apex
if ((doc.FileType == 'MP3' || doc.FileType == 'WAV' || doc.FileType == 'M4A') 
```

### Recommendation

- Define supported formats in a single configurable location
- Add MIME type mapping for the HTML5 audio source element
- Consider future formats (WebM, OGG, FLAC)

**Proposed Configuration:**
```
Audio_Format_Config__mdt
├── Format_Code__c (e.g., "MP3")
├── MIME_Type__c (e.g., "audio/mpeg")
├── Is_Supported__c (Boolean)
└── Fallback_Format__c (reference to another format)
```

---

## Priority 5: UJET Object/Field References (MEDIUM RISK)

### Problem

The Apex controller has hardcoded references to UJET managed package objects and fields:

**`VoicecallSessionController.cls` (lines 60-76):**
```apex
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
```

### Recommendation

While we cannot avoid referencing the UJET object, we should:

1. **Create a Field Mapping Configuration** for flexible field access:
```
Session_Field_Mapping__mdt
├── Logical_Field__c (e.g., "Duration", "Status", "CallType")
├── Actual_API_Name__c (e.g., "UJET__Call_Duration__c")
├── Field_Type__c (e.g., "Number", "Text", "DateTime")
├── Default_Value__c (fallback if field is null/missing)
└── Is_Required__c
```

2. **Add version checking** for UJET package compatibility
3. **Document minimum required UJET package version**

---

## Priority 6: UI/UX Configuration (LOW RISK)

### Problem

Various UI values are hardcoded:

| Value | Location | Current |
|-------|----------|---------|
| Playback speeds | `callTranscriptPlayer.html` | 0.5x, 1x, 1.5x, 2x |
| Skip interval | `callTranscriptPlayer.js` lines 375-385 | 10 seconds |
| Date locale | `voicecallSessionPlayer.js` line 66 | 'en-US' |
| Transcript height | `callTranscriptPlayer.css` line 246 | 400px |
| Default labels | `voicecallSessionPlayer.js` lines 46-47 | "Unknown Agent", "Voice Call" |
| Recording icons | `callTranscriptPlayer.js` lines 84, 91, 99 | 🎙️, 👤, 🤖 |

### Recommendation

Create a **UI Configuration** custom setting or design token file:

**Option A: Custom Setting (Hierarchical)**
```
Call_Player_UI_Settings__c
├── Playback_Speeds__c (e.g., "0.5,1,1.5,2")
├── Skip_Interval_Seconds__c (e.g., 10)
├── Default_Locale__c (e.g., "en-US")
├── Transcript_Max_Height__c (e.g., "400px")
├── Default_Agent_Label__c (e.g., "Unknown Agent")
├── Default_Call_Type__c (e.g., "Voice Call")
└── Auto_Expand_Single_Session__c (Boolean)
```

**Option B: Design Tokens (LWC Native)**
Create a design tokens file for CSS values that can be overridden at the org level.

---

## Priority 7: Download URL Pattern (LOW RISK)

### Problem

**`VoicecallSessionController.cls` (line 123):**
```apex
docWrapper.downloadUrl = '/sfc/servlet.shepherd/version/download/' + doc.LatestPublishedVersionId;
```

This URL pattern is standard Salesforce but could change in future releases.

### Recommendation

- Extract to a constant or configuration
- Add error handling/fallback for URL generation
- Consider using `ContentDistribution` for public URLs in some cases

---

## Implementation Phases

### Phase 1: Critical File Pattern Configuration (2-3 weeks)
1. Create `File_Pattern_Config__mdt` custom metadata type
2. Migrate hardcoded patterns to metadata records
3. Update `callTranscriptPlayer.js` to read patterns from Apex
4. Add new Apex method to retrieve pattern configurations
5. Update unit tests with configurable patterns

### Phase 2: Transcript Format Flexibility (2 weeks)
1. Create `Transcript_Format_Config__mdt` custom metadata type
2. Refactor `parseTranscript()` to use configurable patterns
3. Add fallback/multi-format support
4. Add logging for parsing failures
5. Update test coverage

### Phase 3: Speaker Role Configuration (1 week)
1. Create `Speaker_Role_Config__mdt` custom metadata type
2. Refactor speaker classification logic
3. Update CSS to support dynamic class generation
4. Test with various speaker name formats

### Phase 4: UI/UX Configurability (1 week)
1. Create `Call_Player_UI_Settings__c` custom setting
2. Expose settings via Apex to LWC
3. Update components to use configurable values
4. Document all configurable settings

### Phase 5: Audio Format Extensibility (1 week)
1. Centralize format definitions
2. Add MIME type mapping
3. Update both Apex and LWC references
4. Test with various audio formats

---

## Testing Strategy

### Configuration Migration Testing
- Verify default configurations match current hardcoded behavior
- Test each configurable parameter independently
- Validate error handling when configuration is missing/invalid

### Regression Testing
- Ensure existing transcript files parse correctly
- Verify recording/transcript matching works as before
- Confirm speaker roles display with correct styling

### Forward Compatibility Testing
- Create test files with alternative naming patterns
- Validate configuration changes take effect without deployment
- Test multi-format transcript parsing

---

## Monitoring & Alerting

### Recommended Metrics
1. **Parsing Success Rate** - Track % of transcripts that parse successfully
2. **Pattern Match Rate** - Monitor how often file patterns match expected types
3. **Configuration Access** - Log when configurations are read/applied
4. **Fallback Usage** - Track when default/fallback values are used

### Alert Conditions
- Parsing success rate drops below 95%
- New file patterns detected that don't match any configuration
- Configuration metadata is deleted or corrupted

---

## Documentation Updates

After implementation, update the following:

1. **README.md** - Add configuration section
2. **Create CONFIGURATION.md** - Detailed configuration guide
3. **Create TROUBLESHOOTING.md** - Common issues and solutions
4. **Update permission sets** - Include metadata access if needed

---

## Appendix A: Current Hardcoded Values Summary

| Category | Value | File | Line(s) |
|----------|-------|------|---------|
| Transcript prefix | `va_`, `va_transcript` | callTranscriptPlayer.js | 70 |
| Transcript prefix | `rt_`, `rt_transcript` | callTranscriptPlayer.js | 72-73 |
| Audio suffix | `_2` | callTranscriptPlayer.js | 87 |
| Audio types | MP3, WAV, M4A | callTranscriptPlayer.js | 60-61 |
| Audio types | MP3, WAV, M4A | VoicecallSessionController.cls | 128, 138 |
| Timestamp regex | `\[(\d{2}:\d{2}:\d{2})\s+(.+?)\]\s*(.*)` | VoicecallSessionController.cls | 207 |
| Header patterns | `Call ID:`, `---` | VoicecallSessionController.cls | 201 |
| Speaker: Bot | `virtual agent`, `bot` | callTranscriptPlayer.js | 251 |
| Speaker: Customer | `customer`, `caller` | callTranscriptPlayer.js | 254 |
| Skip seconds | 10 | callTranscriptPlayer.js | 377, 383 |
| Playback speeds | 0.5, 1, 1.5, 2 | callTranscriptPlayer.html | 79-100 |
| Date locale | `en-US` | voicecallSessionPlayer.js | 66 |
| Default agent | `Unknown Agent` | voicecallSessionPlayer.js | 46 |
| Default type | `Voice Call` | voicecallSessionPlayer.js | 47 |
| Transcript height | 400px | callTranscriptPlayer.css | 246 |
| Download URL | `/sfc/servlet.shepherd/version/download/` | VoicecallSessionController.cls | 123 |
| Recording icons | 🎙️, 👤, 🤖 | callTranscriptPlayer.js | 84, 91, 99 |

---

## Appendix B: Sample Transcript Formats

### Current Format (Google CCAAS)
```
Call ID: 2403   |   2025-12-18     HST   |   49 sec
--------------------------------------------------

[16:55:50     Virtual Agent: DCCA Virtual Agent]     Aloha! Thank you...
[16:56:23     Virtual Agent: DCCA Virtual Agent]     For information...
```

### Alternative Formats to Consider Supporting
```
# Twilio Format (example)
[2025-12-18 16:55:50] <Agent> Hello, how can I help?
[2025-12-18 16:55:55] <Customer> I need assistance with...

# Amazon Connect Format (example)
16:55:50,AGENT,John Smith,Hello how can I help you today?
16:55:55,CUSTOMER,,I have a question about my account.

# Generic SRT-style
1
00:00:00,000 --> 00:00:05,000
Agent: Hello, how can I help?

2
00:00:05,000 --> 00:00:10,000
Customer: I need assistance.
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-02 | - | Initial draft |

