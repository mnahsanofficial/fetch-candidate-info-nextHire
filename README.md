# LinkedIn Contact Extractor

A Chrome extension (Manifest V3) that helps recruiters extract candidate information from LinkedIn profiles and uploaded CVs. The extension only extracts visible data from LinkedIn and provides local CV parsing capabilities.

## Features

### LinkedIn Profile Extraction
- **Name**: Extracted from profile header
- **Total Years of Experience**: Calculated from experience section job durations
- **Tech Stack/Skills**: Extracted from LinkedIn Skills section and About section
- **Contact Info**: Extracted from LinkedIn Contact Info modal (email, phone, websites)

### CV Parsing
- **File Support**: PDF and DOCX files
- **Local Processing**: No server calls, all parsing happens locally
- **Contact Extraction**: Uses regex patterns to find email addresses and phone numbers
- **Skills Detection**: Basic keyword scanning for common tech skills
- **Review Interface**: Shows parsed results for manual review and editing

### User Interface
- **Clean Design**: Modern, responsive popup interface
- **Drag & Drop**: Easy CV file upload with drag and drop support
- **Editable Fields**: All extracted data can be reviewed and edited
- **Copy to Clipboard**: One-click copying of all candidate information
- **Status Messages**: Clear feedback for all operations

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. **Download or Clone** this repository to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer Mode** by toggling the switch in the top-right corner
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Method 2: Create Extension Package

1. **Zip the extension folder** (excluding node_modules if any)
2. **Go to Chrome Web Store Developer Dashboard**
3. **Upload the zip file** and follow the publishing process

## Usage

### Extracting LinkedIn Profile Data

1. **Navigate** to any LinkedIn profile page (e.g., `https://www.linkedin.com/in/username/`)
2. **Click the extension icon** in your Chrome toolbar
3. **Click "Fetch LinkedIn Profile"** to extract visible data
4. **Review the extracted data** in the popup
5. **Edit any fields** if needed

### Processing CV Files

1. **Open the extension popup**
2. **Upload a CV** by either:
   - Clicking the upload area and selecting a file
   - Dragging and dropping a PDF or DOCX file
3. **Review the parsed data** in the CV section
4. **Edit the extracted information** as needed

### Copying Data

1. **Ensure all desired data** is filled in (from LinkedIn and/or CV)
2. **Click "Copy to Clipboard"** to copy all information
3. **Paste the data** into your recruitment system or notes

## File Structure

```
linkedin-contact-extractor/
├── manifest.json              # Extension configuration
├── service_worker.js          # Background script
├── content_script.js          # LinkedIn DOM extraction
├── popup.html                 # Extension popup UI
├── popup.js                   # Popup functionality
├── popup.css                  # Popup styling
├── package.json               # Project metadata
├── README.md                  # This file
└── icons/                     # Extension icons (optional)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## Technical Details

### Architecture
- **Manifest V3**: Uses the latest Chrome extension manifest format
- **Service Worker**: Handles background tasks and message passing
- **Content Script**: Injected into LinkedIn pages for DOM extraction
- **Popup Interface**: Clean, responsive UI for user interaction

### Data Extraction
- **LinkedIn**: Only extracts visible DOM elements, never hidden data
- **CV Parsing**: Uses PDF.js for PDF files and mammoth.js for DOCX files
- **Local Storage**: Uses Chrome's storage API for temporary data persistence
- **No Server Calls**: All processing happens locally in the browser

### Security & Privacy
- **No Data Transmission**: All data stays on your local machine
- **LinkedIn Compliance**: Only extracts publicly visible information
- **User Control**: All extracted data can be reviewed and edited
- **Temporary Storage**: Data is only stored locally and can be cleared

## Browser Compatibility

- **Chrome**: Version 88+ (Manifest V3 support)
- **Edge**: Version 88+ (Chromium-based)
- **Other Chromium browsers**: Should work with Manifest V3 support

## Limitations

1. **LinkedIn Changes**: LinkedIn may update their DOM structure, requiring extension updates
2. **Contact Info**: Only extracts contact info if the LinkedIn Contact Info modal is visible
3. **CV Parsing**: Basic text extraction; complex formatting may not be preserved
4. **Skills Detection**: Uses keyword matching; may miss custom or uncommon skills

## Troubleshooting

### Extension Not Working
- Ensure you're on a LinkedIn profile page
- Check that the extension is enabled in `chrome://extensions/`
- Try refreshing the LinkedIn page and clicking the extension again

### CV Upload Issues
- Ensure the file is PDF or DOCX format
- Check file size (very large files may cause issues)
- Try with a different CV file to isolate the problem

### Data Not Extracting
- LinkedIn may have updated their page structure
- Ensure you're on a public profile (some private profiles may have different layouts)
- Try opening the LinkedIn Contact Info modal before extracting

## Development

### Local Development Setup

1. **Clone the repository**
2. **Load as unpacked extension** in Chrome
3. **Make changes** to the code
4. **Reload the extension** in `chrome://extensions/`
5. **Test changes** on LinkedIn

### Code Structure

- **manifest.json**: Extension configuration and permissions
- **service_worker.js**: Background script for message handling
- **content_script.js**: LinkedIn DOM extraction logic
- **popup.html/css/js**: User interface and interactions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

This extension is designed for legitimate recruitment purposes. Users are responsible for complying with LinkedIn's Terms of Service and applicable data protection laws. The extension only extracts publicly visible information and does not bypass any LinkedIn security measures.

## Support

For issues, feature requests, or questions:
1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information

---

**Note**: This extension is not affiliated with LinkedIn Corporation. LinkedIn is a trademark of LinkedIn Corporation.
# fetch-candidate-info-nextHire
