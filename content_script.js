// Content Script for LinkedIn Contact Extractor
// Extracts visible profile data from LinkedIn DOM

(function() {
  'use strict';

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractProfileData') {
      const profileData = extractLinkedInProfileData();
      sendResponse({ success: true, data: profileData });
    }
  });

  /**
   * Extract profile data from LinkedIn DOM
   * Only extracts visible data, never hidden fields
   */
  function extractLinkedInProfileData() {
    const profileData = {
      name: '',
      totalYearsExperience: 0,
      techStack: [],
      contactInfo: {
        email: '',
        phone: '',
        websites: []
      },
      extractedAt: new Date().toISOString()
    };

    try {
      // Extract name from profile header
      profileData.name = extractName();
      
      // Extract years of experience
      profileData.totalYearsExperience = calculateTotalExperience();
      
      // Extract tech stack/skills
      profileData.techStack = extractTechStack();
      
      // Extract contact info (if contact info modal is visible)
      profileData.contactInfo = extractContactInfo();

    } catch (error) {
      console.error('Error extracting profile data:', error);
    }

    return profileData;
  }

  /**
   * Extract name from profile header
   */
  function extractName() {
    // Try multiple selectors for name
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'h1[data-generated-suggestion-target]',
      '.pv-text-details__left-panel h1',
      '.ph5 h1',
      'h1.break-words'
    ];

    for (const selector of nameSelectors) {
      const nameElement = document.querySelector(selector);
      if (nameElement && nameElement.textContent.trim()) {
        return nameElement.textContent.trim();
      }
    }

    return '';
  }

  /**
   * Calculate total years of experience from experience section
   */
  function calculateTotalExperience() {
    let totalMonths = 0;
    
    try {
      // Look for experience section
      const experienceSection = document.querySelector('#experience') || 
                               document.querySelector('[data-section="experience"]') ||
                               document.querySelector('.experience-section');
      
      if (!experienceSection) return 0;

      // Find all experience entries
      const experienceEntries = experienceSection.querySelectorAll('.pv-entity__date-range, .pvs-entity__caption-wrapper');
      
      experienceEntries.forEach(entry => {
        const dateText = entry.textContent;
        const months = parseExperienceDuration(dateText);
        totalMonths += months;
      });

    } catch (error) {
      console.error('Error calculating experience:', error);
    }

    return Math.round(totalMonths / 12 * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Parse experience duration from text
   */
  function parseExperienceDuration(dateText) {
    const text = dateText.toLowerCase();
    let months = 0;

    // Extract years and months from text like "2 yrs 3 mos" or "Jan 2020 - Present"
    const yearMatch = text.match(/(\d+)\s*(?:year|yr|y)/);
    const monthMatch = text.match(/(\d+)\s*(?:month|mo|mos)/);
    
    if (yearMatch) {
      months += parseInt(yearMatch[1]) * 12;
    }
    if (monthMatch) {
      months += parseInt(monthMatch[1]);
    }

    // If no explicit duration, try to parse date ranges
    if (months === 0) {
      const dateRangeMatch = text.match(/(\d{4})\s*[-–]\s*(?:present|current|now|\d{4})/);
      if (dateRangeMatch) {
        const startYear = parseInt(dateRangeMatch[1]);
        const currentYear = new Date().getFullYear();
        months = (currentYear - startYear) * 12;
      }
    }

    return months;
  }

  /**
   * Extract tech stack/skills from skills section
   */
  function extractTechStack() {
    const skills = [];
    
    try {
      // Look for skills section
      const skillsSection = document.querySelector('#skills') || 
                           document.querySelector('[data-section="skills"]') ||
                           document.querySelector('.skills-section');
      
      if (!skillsSection) return skills;

      // Find skill elements
      const skillElements = skillsSection.querySelectorAll('.pv-skill-category-entity__name, .pvs-entity__caption-wrapper, .skill-category-entity__name');
      
      skillElements.forEach(element => {
        const skillText = element.textContent.trim();
        if (skillText && !skills.includes(skillText)) {
          skills.push(skillText);
        }
      });

      // Also look for skills in the "About" section
      const aboutSection = document.querySelector('#about') || 
                          document.querySelector('[data-section="about"]');
      
      if (aboutSection) {
        const aboutText = aboutSection.textContent.toLowerCase();
        const techKeywords = [
          'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node.js', 'express',
          'mongodb', 'mysql', 'postgresql', 'aws', 'azure', 'docker', 'kubernetes',
          'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'agile', 'scrum',
          'html', 'css', 'sass', 'less', 'typescript', 'php', 'ruby', 'go',
          'c++', 'c#', '.net', 'spring', 'django', 'flask', 'laravel'
        ];
        
        techKeywords.forEach(keyword => {
          if (aboutText.includes(keyword) && !skills.includes(keyword)) {
            skills.push(keyword);
          }
        });
      }

    } catch (error) {
      console.error('Error extracting skills:', error);
    }

    return skills.slice(0, 20); // Limit to 20 skills
  }

  /**
   * Extract contact info from contact info modal (if visible)
   */
  function extractContactInfo() {
    const contactInfo = {
      email: '',
      phone: '',
      websites: []
    };

    try {
      // Check if contact info modal is open
      const contactModal = document.querySelector('.pv-contact-info__contact-type, .ci-v2-modal, .contact-info-modal');
      
      if (contactModal) {
        // Extract email
        const emailElement = contactModal.querySelector('a[href^="mailto:"]');
        if (emailElement) {
          contactInfo.email = emailElement.href.replace('mailto:', '');
        }

        // Extract phone
        const phoneElement = contactModal.querySelector('a[href^="tel:"]');
        if (phoneElement) {
          contactInfo.phone = phoneElement.href.replace('tel:', '');
        }

        // Extract websites
        const websiteElements = contactModal.querySelectorAll('a[href^="http"]:not([href*="linkedin.com"])');
        websiteElements.forEach(element => {
          const url = element.href;
          if (url && !contactInfo.websites.includes(url)) {
            contactInfo.websites.push(url);
          }
        });
      }

    } catch (error) {
      console.error('Error extracting contact info:', error);
    }

    return contactInfo;
  }

  // Helper function to wait for element to appear
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error('Element not found within timeout'));
      }, timeout);
    });
  }

})();
