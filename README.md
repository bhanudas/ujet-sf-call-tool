# UJET Salesforce Call Tool

A Salesforce Lightning Web Component (LWC) solution for playing call recordings with synchronized transcript display, designed for UJET and Google CCAAS (Contact Center as a Service) integration.

## Overview

This tool provides a rich call playback experience within Salesforce, allowing agents and supervisors to:

- 🎧 Play call recordings directly from Case records
- 📜 View synchronized transcripts that highlight as audio plays
- 🤖 Support for both Virtual Agent (VA) and Real-Time (RT) transcripts
- 🔄 Handle multiple recordings per session (e.g., IVR + Agent calls)
- 💊 Intuitive "pill" interface to switch between recordings (Virtual Agent vs. Agent)
- ⏩ Variable playback speed (0.5x, 1x, 1.5x, 2x)
- 📍 Click-to-seek within transcripts
- 🖱️ Auto-scroll functionality with toggle control
- 🐛 Enhanced debugging with a centralized Logger Service

## Prerequisites

### Required Dependencies

| Dependency               | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **UJET Managed Package** | Required for `UJET__UJET_Session__c` object and call data. Install from UJET/Google. |
| **Google CCAAS**         | Provides call recordings and transcript generation (VA and RT transcripts)           |
| **Salesforce Platform**  | API version 59.0 or higher                                                           |

### UJET Session Object Fields Used

The solution queries these fields from `UJET__UJET_Session__c`:

- `UJET__Call_Duration__c` - Call duration in seconds
- `UJET__Session_Type__c` - Type of session (Voice, Chat, etc.)
- `UJET__Status__c` - Session status
- `UJET__Call_Id__c` - Unique call identifier
- `UJET__Case__c` - Related Case lookup

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/bhanudas/ujet-sf-call-tool.git
cd ujet-sf-call-tool
```

### 2. Install Dependencies (for development)

```bash
npm install
```

### 3. Authorize Your Salesforce Org

```bash
sf org login web -a MyOrg
```

### 4. Deploy to Salesforce

```bash
sf project deploy start --target-org MyOrg
```

### 5. Assign Permission Set

Assign the included permission set to users who need to review calls:

1. Navigate to **Setup → Permission Sets**
2. Find **Voice Call Reviewer** or **Voice Call Reviewer - Platform** (depending on user license)
3. Click **Manage Assignments → Add Assignment**
4. Select users and save

### 6. Add Component to Case Record Page

1. Navigate to **Setup → Object Manager → Case → Lightning Record Pages**
2. Edit the desired record page
3. Drag the **Voicecall Session Player** component onto the page
4. Save and activate

## Components

### `voicecallSessionPlayer`

**Parent component** that displays on Case record pages.

- Fetches all UJET Sessions related to the Case
- Displays sessions in an accordion layout
- Auto-expands when only one session exists
- Formats dates and durations for readability

### `callTranscriptPlayer`

**Child component** for individual session playback.

- Audio player with standard controls (play/pause, skip, speed)
- **Smart Recording Selection**: Automatically detects and labels recordings (Virtual Agent vs. Agent) based on file naming conventions
- **Transcript Synchronization**: Highlights the current line in the transcript as audio plays
- **Transcript Matching**: Automatically pairs the correct transcript file with its corresponding audio recording
- **Auto-scroll**: Keeps the active transcript line in view (toggleable)
- **Download**: Button to download the full transcript file
- **Platform License Support**: Fetches audio via Apex for users without direct file servlet access

### `loggerService`

**Utility component** for centralized logging.

- Provides color-coded, formatted console logs
- Supports log levels (debug, info, warn, error)
- Groups related logs for cleaner console output
- Includes performance timing utilities

## File Structure

```
force-app/
└── main/
    └── default/
        ├── classes/
        │   ├── VoicecallSessionController.cls           # Apex controller
        │   ├── VoicecallSessionController.cls-meta.xml
        │   ├── VoicecallSessionControllerTest.cls       # Test class (97% coverage)
        │   └── VoicecallSessionControllerTest.cls-meta.xml
        ├── lwc/
        │   ├── voicecallSessionPlayer/                  # Parent LWC
        │   │   ├── voicecallSessionPlayer.html
        │   │   ├── voicecallSessionPlayer.js
        │   │   ├── voicecallSessionPlayer.css
        │   │   ├── voicecallSessionPlayer.js-meta.xml
        │   │   └── __tests__/
        │   │       └── voicecallSessionPlayer.test.js
        │   ├── callTranscriptPlayer/                    # Child LWC
        │   │   ├── callTranscriptPlayer.html
        │   │   ├── callTranscriptPlayer.js
        │   │   ├── callTranscriptPlayer.css
        │   │   ├── callTranscriptPlayer.js-meta.xml
        │   │   └── __tests__/
        │   │       └── callTranscriptPlayer.test.js
        │   └── loggerService/                           # Logging Utility
        │       ├── loggerService.js
        │       └── loggerService.js-meta.xml
        └── permissionsets/
            ├── Voice_Call_Reviewer.permissionset-meta.xml
            └── Voice_Call_Reviewer_Platform.permissionset-meta.xml
```

## Apex Controller Methods

The `VoicecallSessionController` provides these `@AuraEnabled` methods:

| Method                                | Description                                                             |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `getVoicecallSessions(caseId)`        | Retrieves all UJET Sessions for a Case with their documents (cacheable) |
| `getTranscriptContent(documentId)`    | Fetches transcript text content from ContentVersion                     |
| `getAudioContent(documentId)`         | Fetches audio as base64 data for Platform license support               |
| `parseTranscript(content, startTime)` | Parses transcript text into structured entries with timing              |

## Permission Sets

Two permission sets are included for different license types:

| Permission Set                     | License Type        | Use For                        |
| ---------------------------------- | ------------------- | ------------------------------ |
| **Voice Call Reviewer**            | Salesforce          | Full Salesforce licensed users |
| **Voice Call Reviewer - Platform** | Salesforce Platform | Platform licensed users        |

Both permission sets grant:

| Access Type | Details                                                           |
| ----------- | ----------------------------------------------------------------- |
| **Object**  | Read + View All on `UJET__UJET_Session__c`                        |
| **Fields**  | Read on Call Duration, Session Type, Status, Call ID, Case lookup |
| **Apex**    | `VoicecallSessionController` class access                         |

> **Note:** File access for recordings and transcripts is controlled by Salesforce's standard content sharing. Users can access files attached to records they have access to.

### Platform License Audio Playback

Platform license users have restricted access to Salesforce's file servlet (`/sfc/servlet.shepherd/`), which can prevent direct audio playback. To address this, the component:

1. **Fetches audio via Apex**: The `getAudioContent()` method retrieves audio files as base64-encoded data through Apex, which has proper ContentVersion access
2. **Creates blob URLs**: The LWC converts the base64 data to a blob URL for the HTML5 audio element
3. **Caches for performance**: Blob URLs are cached to avoid re-fetching when switching between recordings

This approach mirrors how transcripts are fetched (via `getTranscriptContent()`) and ensures consistent functionality across license types.

## Transcript Format

The component parses transcripts in the following format:

```
Call ID: 12345
---
[HH:MM:SS     Speaker Name]     Transcript text here
[HH:MM:SS     Another Speaker]  More transcript text
```

### Supported Transcript Types

| Prefix            | Type          | Description                        |
| ----------------- | ------------- | ---------------------------------- |
| `va_transcript_*` | Virtual Agent | IVR/Bot conversation transcript    |
| `rt_transcript_*` | Real-Time     | Live agent conversation transcript |

### Recording Matching

Recordings are automatically matched to transcripts:

- Primary recording (no `_2` suffix) → `va_transcript_*` (Virtual Agent)
- Secondary recording (`*_2.mp3`) → `rt_transcript_*` (Agent)

## Development

### Linting

ESLint is configured for LWC with Salesforce rules:

```bash
# Run linter
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Apex Linting

PMD is configured for Apex code quality. Requires [Salesforce CLI Scanner Plugin](https://forcedotcom.github.io/sfdx-scanner/):

```bash
# Install scanner plugin
sf plugins install @salesforce/sfdx-scanner

# Run Apex linter
npm run lint:apex
```

### Unit Testing

LWC Jest is configured for component testing:

```bash
# Run tests
npm run test:unit

# Run with coverage
npm run test:unit:coverage

# Watch mode
npm run test:unit:watch
```

## Configuration

### Adjusting Playback Speeds

Edit `callTranscriptPlayer.html` to modify available speed options:

```html
<lightning-button label="0.5x" data-speed="0.5" ...></lightning-button>
<lightning-button label="1x" data-speed="1" ...></lightning-button>
<lightning-button label="1.5x" data-speed="1.5" ...></lightning-button>
<lightning-button label="2x" data-speed="2" ...></lightning-button>
```

### Transcript Parsing

Modify `VoicecallSessionController.parseTranscript()` to adjust the regex pattern for different transcript formats.

### Logging Configuration

The `loggerService` can be configured in `loggerService.js`:

```javascript
const CONFIG = {
  ENABLED: true, // Master switch
  MIN_LEVEL: "debug", // 'debug' | 'info' | 'warn' | 'error'
  APP_PREFIX: "UJET", // Log prefix
  ENABLE_TIMING: true, // Enable performance timers
  ENABLE_GROUPING: true, // Enable log grouping
};
```

## Troubleshooting

### No recordings appearing

1. Verify UJET Sessions exist for the Case
2. Check ContentDocumentLinks are attached to UJET Sessions
3. Ensure audio files have `.mp3`, `.wav`, or `.m4a` extensions

### Audio not playing (Platform license users)

If Platform license users see "Unable to play audio" or the audio doesn't load:

1. Check browser console for `[UJET-CallTool CallTranscriptPlayer]` logs
2. Look for "Loading Audio via Apex" followed by "Audio blob URL created" - this indicates successful fetch
3. If you see "Failed to load audio via Apex", verify:
   - User has the **Voice Call Reviewer - Platform** permission set assigned
   - User has access to the Case and its related UJET Session records
   - The `VoicecallSessionController` Apex class is accessible

**Technical Details**: Platform license users cannot access Salesforce's file servlet directly. The component fetches audio through the `getAudioContent()` Apex method, which returns base64-encoded audio data that's converted to a blob URL for playback.

### Transcript not syncing

1. Confirm transcript follows expected format with timestamps `[HH:MM:SS Speaker]`
2. Check browser console for parsing errors (look for `[UJET-CallTool]` logs)
3. Verify transcript file is linked to the UJET Session

### Permission errors

Assign the appropriate permission set for the user's license type:

- **Salesforce license**: Assign **Voice Call Reviewer**
- **Platform license**: Assign **Voice Call Reviewer - Platform**

Ensure the user has:

- Read access to `UJET__UJET_Session__c` and required fields
- Access to files attached to records they can view
- Access to `VoicecallSessionController` Apex class

## License

MIT

## Support

For issues related to:

- **UJET Integration**: Contact UJET/Google Support
- **This Component**: Open an issue in this repository
