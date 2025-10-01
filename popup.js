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
        copyToClipboardBtn: document.getElementById('copyToClipboardBtn'),
        clearDataBtn: document.getElementById('clearDataBtn'),
        versionInfo: document.getElementById('versionInfo')
    };

    // State
    let profileData = null;

    // Initialize popup
    document.addEventListener('DOMContentLoaded', function() {
        initializeEventListeners();
        loadSavedData();
        setDynamicVersion();
    });

    /**
     * Initialize all event listeners
     */
    function initializeEventListeners() {
        // LinkedIn profile extraction
        elements.fetchProfileBtn.addEventListener('click', fetchLinkedInProfile);

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

            // Try to inject content script if not already injected
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content_script.js']
                });
            } catch (injectError) {
                // Content script might already be injected, continue
                console.log('Content script injection result:', injectError.message);
            }

            // Wait a moment for script to initialize
            await new Promise(resolve => setTimeout(resolve, 100));

            // Send message directly to content script
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractProfileData' });
            
            if (response && response.success) {
                profileData = response.data;
                displayProfileData(profileData);
                await saveProfileData(profileData);
                showStatus(elements.profileStatus, 'Profile data extracted successfully!', 'success');
            } else {
                showStatus(elements.profileStatus, (response && response.error) || 'Failed to extract profile data', 'error');
            }

        } catch (error) {
            console.error('Error fetching profile:', error);
            if (error.message && error.message.includes('Could not establish connection')) {
                showStatus(elements.profileStatus, 'Please refresh the LinkedIn page and try again', 'error');
            } else {
                showStatus(elements.profileStatus, 'Error extracting profile data', 'error');
            }
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
            name: elements.name.value || '',
            experience: elements.experience.value || '',
            techStack: elements.techStack.value || '',
            contactInfo: elements.contactInfo.value || '',
            source: 'LinkedIn Profile',
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

            // Hide sections
            elements.profileDataSection.style.display = 'none';

            // Clear status messages
            elements.profileStatus.textContent = '';
            elements.profileStatus.className = 'status-message';

            // Clear stored data
            profileData = null;
            await chrome.runtime.sendMessage({ action: 'clearProfileData' });
        }
    }

    /**
     * Make form fields editable
     */
    function makeFieldsEditable() {
        const editableFields = [
            elements.name, elements.experience, elements.techStack, elements.contactInfo
        ];

        editableFields.forEach(field => {
            field.removeAttribute('readonly');
            field.style.background = 'white';
        });
    }

    /**
     * Set dynamic version information
     */
    function setDynamicVersion() {
        const manifest = chrome.runtime.getManifest();
        const version = manifest.version || '1.0.0';
        const currentDate = new Date().getFullYear();
        
        if (elements.versionInfo) {
            elements.versionInfo.textContent = `NextHire Contact Extractor v${version} © ${currentDate}`;
        }
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
