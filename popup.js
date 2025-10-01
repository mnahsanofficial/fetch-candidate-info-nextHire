// Popup Script for LinkedIn Contact Extractor
// Handles UI interactions, CV parsing, and data management

(function() {
    'use strict';

    // DOM Elements
    const elements = {
        fetchProfileBtn: document.getElementById('fetchProfileBtn'),
        profileStatus: document.getElementById('profileStatus'),
        profileDataSection: document.getElementById('profileDataSection'),
        name: document.getElementById('name'),
        experience: document.getElementById('experience'),
        techStack: document.getElementById('techStack'),
        contactInfo: document.getElementById('contactInfo'),
        uploadArea: document.getElementById('uploadArea'),
        cvFileInput: document.getElementById('cvFileInput'),
        cvStatus: document.getElementById('cvStatus'),
        cvDataSection: document.getElementById('cvDataSection'),
        cvName: document.getElementById('cvName'),
        cvContact: document.getElementById('cvContact'),
        cvSkills: document.getElementById('cvSkills'),
        copyToClipboardBtn: document.getElementById('copyToClipboardBtn'),
        clearDataBtn: document.getElementById('clearDataBtn')
    };

    // State
    let profileData = null;
    let cvData = null;

    // Initialize popup
    document.addEventListener('DOMContentLoaded', function() {
        initializeEventListeners();
        loadSavedData();
    });

    /**
     * Initialize all event listeners
     */
    function initializeEventListeners() {
        // LinkedIn profile extraction
        elements.fetchProfileBtn.addEventListener('click', fetchLinkedInProfile);

        // CV upload
        elements.uploadArea.addEventListener('click', () => elements.cvFileInput.click());
        elements.cvFileInput.addEventListener('change', handleCVUpload);
        
        // Drag and drop for CV
        elements.uploadArea.addEventListener('dragover', handleDragOver);
        elements.uploadArea.addEventListener('dragleave', handleDragLeave);
        elements.uploadArea.addEventListener('drop', handleDrop);

        // Action buttons
        elements.copyToClipboardBtn.addEventListener('click', copyToClipboard);
        elements.clearDataBtn.addEventListener('click', clearAllData);

        // Make form fields editable
        makeFieldsEditable();
    }

    /**
     * Fetch LinkedIn profile data
     */
    async function fetchLinkedInProfile() {
        try {
            setButtonLoading(elements.fetchProfileBtn, true);
            showStatus(elements.profileStatus, 'Extracting profile data...', 'info');

            // Check if we're on LinkedIn
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('linkedin.com')) {
                showStatus(elements.profileStatus, 'Please navigate to a LinkedIn profile page first', 'error');
                return;
            }

            // Send message to content script
            const response = await chrome.runtime.sendMessage({ action: 'extractProfileData' });
            
            if (response.success) {
                profileData = response.data;
                displayProfileData(profileData);
                await saveProfileData(profileData);
                showStatus(elements.profileStatus, 'Profile data extracted successfully!', 'success');
            } else {
                showStatus(elements.profileStatus, response.error || 'Failed to extract profile data', 'error');
            }

        } catch (error) {
            console.error('Error fetching profile:', error);
            showStatus(elements.profileStatus, 'Error extracting profile data', 'error');
        } finally {
            setButtonLoading(elements.fetchProfileBtn, false);
        }
    }

    /**
     * Display profile data in the UI
     */
    function displayProfileData(data) {
        elements.name.value = data.name || '';
        elements.experience.value = data.totalYearsExperience ? `${data.totalYearsExperience} years` : '';
        elements.techStack.value = data.techStack ? data.techStack.join(', ') : '';
        
        const contactInfoText = [];
        if (data.contactInfo.email) contactInfoText.push(`Email: ${data.contactInfo.email}`);
        if (data.contactInfo.phone) contactInfoText.push(`Phone: ${data.contactInfo.phone}`);
        if (data.contactInfo.websites.length > 0) {
            contactInfoText.push(`Websites: ${data.contactInfo.websites.join(', ')}`);
        }
        elements.contactInfo.value = contactInfoText.join('\n');

        elements.profileDataSection.style.display = 'block';
    }

    /**
     * Handle CV file upload
     */
    async function handleCVUpload(event) {
        const file = event.target.files[0];
        if (file) {
            await processCVFile(file);
        }
    }

    /**
     * Handle drag over event
     */
    function handleDragOver(event) {
        event.preventDefault();
        elements.uploadArea.classList.add('dragover');
    }

    /**
     * Handle drag leave event
     */
    function handleDragLeave(event) {
        event.preventDefault();
        elements.uploadArea.classList.remove('dragover');
    }

    /**
     * Handle drop event
     */
    async function handleDrop(event) {
        event.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            await processCVFile(files[0]);
        }
    }

    /**
     * Process uploaded CV file
     */
    async function processCVFile(file) {
        try {
            showStatus(elements.cvStatus, 'Processing CV...', 'info');

            // Validate file type
            const fileType = file.type;
            const fileName = file.name.toLowerCase();
            
            if (!fileType.includes('pdf') && !fileName.endsWith('.pdf') && 
                !fileType.includes('wordprocessingml') && !fileName.endsWith('.docx')) {
                showStatus(elements.cvStatus, 'Please upload a PDF or DOCX file', 'error');
                return;
            }

            // Read file content
            const text = await extractTextFromFile(file);
            
            // Parse the text
            cvData = parseCVText(text);
            displayCVData(cvData);
            
            showStatus(elements.cvStatus, 'CV processed successfully!', 'success');

        } catch (error) {
            console.error('Error processing CV:', error);
            showStatus(elements.cvStatus, 'Error processing CV file', 'error');
        }
    }

    /**
     * Extract text from uploaded file
     */
    async function extractTextFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async function(e) {
                try {
                    const arrayBuffer = e.target.result;
                    const fileType = file.type;
                    const fileName = file.name.toLowerCase();

                    let text = '';

                    if (fileType.includes('pdf') || fileName.endsWith('.pdf')) {
                        text = await extractTextFromPDF(arrayBuffer);
                    } else if (fileType.includes('wordprocessingml') || fileName.endsWith('.docx')) {
                        text = await extractTextFromDOCX(arrayBuffer);
                    } else {
                        throw new Error('Unsupported file type');
                    }

                    resolve(text);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Extract text from PDF using pdfjs-dist
     */
    async function extractTextFromPDF(arrayBuffer) {
        try {
            // Load PDF.js library dynamically
            const pdfjsLib = await loadPDFJSLibrary();
            
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }

            return fullText;
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            throw new Error('Failed to extract text from PDF');
        }
    }

    /**
     * Extract text from DOCX using mammoth.js
     */
    async function extractTextFromDOCX(arrayBuffer) {
        try {
            // Load mammoth.js library dynamically
            const mammoth = await loadMammothLibrary();
            
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } catch (error) {
            console.error('Error extracting DOCX text:', error);
            throw new Error('Failed to extract text from DOCX');
        }
    }

    /**
     * Load PDF.js library dynamically
     */
    async function loadPDFJSLibrary() {
        return new Promise((resolve, reject) => {
            if (window.pdfjsLib) {
                resolve(window.pdfjsLib);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(window.pdfjsLib);
            };
            script.onerror = () => reject(new Error('Failed to load PDF.js library'));
            document.head.appendChild(script);
        });
    }

    /**
     * Load mammoth.js library dynamically
     */
    async function loadMammothLibrary() {
        return new Promise((resolve, reject) => {
            if (window.mammoth) {
                resolve(window.mammoth);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
            script.onload = () => resolve(window.mammoth);
            script.onerror = () => reject(new Error('Failed to load mammoth.js library'));
            document.head.appendChild(script);
        });
    }

    /**
     * Parse CV text to extract information
     */
    function parseCVText(text) {
        const cvData = {
            name: '',
            contact: '',
            skills: []
        };

        // Extract name (usually at the top, before contact info)
        const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/m);
        if (nameMatch) {
            cvData.name = nameMatch[1];
        }

        // Extract email
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = text.match(emailRegex) || [];
        
        // Extract phone
        const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
        const phones = text.match(phoneRegex) || [];

        // Extract websites
        const websiteRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
        const websites = text.match(websiteRegex) || [];

        // Build contact info string
        const contactInfo = [];
        if (emails.length > 0) contactInfo.push(`Email: ${emails[0]}`);
        if (phones.length > 0) contactInfo.push(`Phone: ${phones[0]}`);
        if (websites.length > 0) contactInfo.push(`Website: ${websites[0]}`);
        cvData.contact = contactInfo.join('\n');

        // Extract skills/keywords
        const skillKeywords = [
            'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node.js', 'express',
            'mongodb', 'mysql', 'postgresql', 'aws', 'azure', 'docker', 'kubernetes',
            'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'agile', 'scrum',
            'html', 'css', 'sass', 'less', 'typescript', 'php', 'ruby', 'go',
            'c++', 'c#', '.net', 'spring', 'django', 'flask', 'laravel', 'rails',
            'machine learning', 'ai', 'data science', 'sql', 'nosql', 'redis',
            'elasticsearch', 'kafka', 'microservices', 'rest api', 'graphql'
        ];

        const foundSkills = [];
        const lowerText = text.toLowerCase();
        
        skillKeywords.forEach(skill => {
            if (lowerText.includes(skill.toLowerCase()) && !foundSkills.includes(skill)) {
                foundSkills.push(skill);
            }
        });

        cvData.skills = foundSkills.slice(0, 15); // Limit to 15 skills

        return cvData;
    }

    /**
     * Display CV data in the UI
     */
    function displayCVData(data) {
        elements.cvName.value = data.name || '';
        elements.cvContact.value = data.contact || '';
        elements.cvSkills.value = data.skills ? data.skills.join(', ') : '';
        elements.cvDataSection.style.display = 'block';
    }

    /**
     * Copy all data to clipboard
     */
    async function copyToClipboard() {
        try {
            const data = compileAllData();
            const text = formatDataForClipboard(data);
            
            await navigator.clipboard.writeText(text);
            showStatus(elements.profileStatus, 'Data copied to clipboard!', 'success');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            showStatus(elements.profileStatus, 'Failed to copy to clipboard', 'error');
        }
    }

    /**
     * Compile all available data
     */
    function compileAllData() {
        const data = {
            name: elements.name.value || elements.cvName.value || '',
            experience: elements.experience.value || '',
            techStack: elements.techStack.value || elements.cvSkills.value || '',
            contactInfo: elements.contactInfo.value || elements.cvContact.value || '',
            source: profileData ? 'LinkedIn Profile' : 'CV Upload',
            extractedAt: new Date().toLocaleString()
        };

        return data;
    }

    /**
     * Format data for clipboard
     */
    function formatDataForClipboard(data) {
        let text = `CANDIDATE INFORMATION\n`;
        text += `====================\n\n`;
        text += `Name: ${data.name}\n`;
        text += `Experience: ${data.experience}\n`;
        text += `Tech Stack: ${data.techStack}\n`;
        text += `Contact Info:\n${data.contactInfo}\n\n`;
        text += `Source: ${data.source}\n`;
        text += `Extracted: ${data.extractedAt}\n`;
        
        return text;
    }

    /**
     * Clear all data
     */
    async function clearAllData() {
        if (confirm('Are you sure you want to clear all data?')) {
            // Clear form fields
            elements.name.value = '';
            elements.experience.value = '';
            elements.techStack.value = '';
            elements.contactInfo.value = '';
            elements.cvName.value = '';
            elements.cvContact.value = '';
            elements.cvSkills.value = '';
            elements.cvFileInput.value = '';

            // Hide sections
            elements.profileDataSection.style.display = 'none';
            elements.cvDataSection.style.display = 'none';

            // Clear status messages
            elements.profileStatus.textContent = '';
            elements.profileStatus.className = 'status-message';
            elements.cvStatus.textContent = '';
            elements.cvStatus.className = 'status-message';

            // Clear stored data
            profileData = null;
            cvData = null;
            await chrome.runtime.sendMessage({ action: 'clearProfileData' });
        }
    }

    /**
     * Make form fields editable
     */
    function makeFieldsEditable() {
        const editableFields = [
            elements.name, elements.experience, elements.techStack, elements.contactInfo,
            elements.cvName, elements.cvContact, elements.cvSkills
        ];

        editableFields.forEach(field => {
            field.removeAttribute('readonly');
            field.style.background = 'white';
        });
    }

    /**
     * Load saved data on popup open
     */
    async function loadSavedData() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getProfileData' });
            if (response.success && response.data) {
                profileData = response.data;
                displayProfileData(profileData);
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }

    /**
     * Save profile data
     */
    async function saveProfileData(data) {
        try {
            await chrome.runtime.sendMessage({ action: 'saveProfileData', data: data });
        } catch (error) {
            console.error('Error saving profile data:', error);
        }
    }

    /**
     * Show status message
     */
    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = `status-message ${type}`;
        
        // Auto-hide success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                element.textContent = '';
                element.className = 'status-message';
            }, 3000);
        }
    }

    /**
     * Set button loading state
     */
    function setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            button.style.position = 'relative';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            button.style.position = '';
        }
    }

})();
