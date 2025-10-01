// Content Script for LinkedIn Contact Extractor
// Extracts visible profile data from LinkedIn DOM

(function() {
  'use strict';

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractProfileData') {
      try {
        console.log('Content script received extractProfileData request');
        const profileData = extractLinkedInProfileData();
        console.log('Extracted profile data:', profileData);
        sendResponse({ success: true, data: profileData });
      } catch (error) {
        console.error('Error in content script:', error);
        sendResponse({ success: false, error: error.message });
      }
    }
    return true; // Keep message channel open for async response
  });

  // Log that content script is loaded
  console.log('LinkedIn Contact Extractor content script loaded');

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
    // Try multiple selectors for name (updated for current LinkedIn)
    const nameSelectors = [
      'h1.text-heading-xlarge',
      'h1[data-generated-suggestion-target]',
      '.pv-text-details__left-panel h1',
      '.ph5 h1',
      'h1.break-words',
      'h1[data-anonymize="person-name"]',
      '.pv-text-details__left-panel h1 span[aria-hidden="true"]',
      '.pv-text-details__left-panel h1 span:first-child',
      'h1.break-words span[aria-hidden="true"]',
      '.pv-text-details__left-panel h1',
      '.pv-top-card--list-bullet h1',
      '.pv-top-card--list-bullet h1 span[aria-hidden="true"]',
      // New LinkedIn selectors
      'h1[data-anonymize="person-name"] span[aria-hidden="true"]',
      '.pv-text-details__left-panel h1 span:not([aria-hidden="false"])',
      '.pv-top-card--list-bullet h1 span:not([aria-hidden="false"])',
      'h1.break-words span:not([aria-hidden="false"])',
      // Fallback selectors
      'h1',
      '.pv-text-details__left-panel h1',
      '.pv-top-card--list-bullet h1'
    ];

    for (const selector of nameSelectors) {
      const nameElement = document.querySelector(selector);
      if (nameElement && nameElement.textContent.trim()) {
        const name = nameElement.textContent.trim();
        // Filter out common non-name text
        if (name && name.length > 1 && !name.includes('LinkedIn') && !name.includes('Profile')) {
          console.log('Found name with selector:', selector, 'Name:', name);
          return name;
        }
      }
    }

    console.log('No name found with any selector');
    return '';
  }

  /**
   * Calculate total years of experience from experience section
   */
  function calculateTotalExperience() {
    let totalMonths = 0;
    
    try {
      console.log('Looking for experience elements...');
      
      // Look for experience section with multiple selectors
      const experienceSection = document.querySelector('#experience') || 
                               document.querySelector('[data-section="experience"]') ||
                               document.querySelector('.experience-section') ||
                               document.querySelector('#experience ~ *') ||
                               document.querySelector('.pv-profile-section.experience-section');
      
      if (experienceSection) {
        console.log('Found experience section');
        // Find all experience entries
        const experienceEntries = experienceSection.querySelectorAll('.pv-entity__date-range, .pvs-entity__caption-wrapper, .pv-entity__dates, .experience-item__duration, .pv-entity__summary-info-v2 .pv-entity__dates');
        console.log('Found', experienceEntries.length, 'experience entries in section');
        
        experienceEntries.forEach(entry => {
          const dateText = entry.textContent;
          const months = parseExperienceDuration(dateText);
          totalMonths += months;
        });
      } else {
        console.log('No experience section found, trying direct selectors...');
        // Try to find experience entries directly with updated selectors
        const experienceSelectors = [
          '.pv-entity__date-range',
          '.pvs-entity__caption-wrapper',
          '.pv-entity__dates',
          '.experience-item__duration',
          '.pv-entity__summary-info-v2 .pv-entity__dates',
          // New LinkedIn selectors
          '.pvs-entity__caption-wrapper span',
          '.pv-entity__date-range span',
          '.experience-section .pv-entity__date-range',
          '.pv-profile-section.experience-section .pv-entity__date-range',
          '.pv-entity__summary-info-v2 .pv-entity__dates span',
          // More specific selectors
          '[data-section="experience"] .pv-entity__date-range',
          '[data-section="experience"] .pvs-entity__caption-wrapper',
          '.pv-profile-section .pv-entity__date-range',
          '.pv-profile-section .pvs-entity__caption-wrapper'
        ];
        
        experienceSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          console.log(`Experience selector ${selector} found ${elements.length} elements`);
          elements.forEach(element => {
            const dateText = element.textContent;
            const months = parseExperienceDuration(dateText);
            if (months > 0) {
              console.log('Found experience duration:', dateText, '=', months, 'months');
            }
            totalMonths += months;
          });
        });
      }

    } catch (error) {
      console.error('Error calculating experience:', error);
    }

    const years = Math.round(totalMonths / 12 * 10) / 10;
    console.log('Total experience calculated:', years, 'years');
    return years;
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
      console.log('Looking for skills elements...');
      
      // Look for skills section with multiple selectors
      const skillsSection = document.querySelector('#skills') || 
                           document.querySelector('[data-section="skills"]') ||
                           document.querySelector('.skills-section') ||
                           document.querySelector('#skills ~ *') ||
                           document.querySelector('.pv-profile-section.skills-section');
      
      if (skillsSection) {
        console.log('Found skills section');
        // Find skill elements with updated selectors
        const skillSelectors = [
          '.pv-skill-category-entity__name',
          '.pvs-entity__caption-wrapper',
          '.skill-category-entity__name',
          '.pv-skill-category-entity__name-text',
          '.pv-skill-category-entity__name span',
          '.skill-category-entity__name span',
          '.pvs-entity__caption-wrapper span',
          '.pv-skill-category-entity__name-text span',
          '[data-section="skills"] .pv-skill-category-entity__name',
          '[data-section="skills"] .pvs-entity__caption-wrapper',
          '.pv-profile-section.skills-section .pv-skill-category-entity__name',
          '.pv-profile-section.skills-section .pvs-entity__caption-wrapper'
        ];
        
        skillSelectors.forEach(selector => {
          const elements = skillsSection.querySelectorAll(selector);
          console.log(`Skills selector ${selector} found ${elements.length} elements`);
          elements.forEach(element => {
            const skillText = element.textContent.trim();
            if (skillText && !skills.includes(skillText) && skillText.length > 1) {
              skills.push(skillText);
              console.log('Found skill:', skillText);
            }
          });
        });
      } else {
        console.log('No skills section found, trying direct selectors...');
        // Try direct selectors if no section found
        const skillSelectors = [
          '.pv-skill-category-entity__name',
          '.pvs-entity__caption-wrapper',
          '.skill-category-entity__name',
          '.pv-skill-category-entity__name-text',
          '.pv-skill-category-entity__name span',
          '.skill-category-entity__name span'
        ];
        
        skillSelectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          console.log(`Direct skills selector ${selector} found ${elements.length} elements`);
          elements.forEach(element => {
            const skillText = element.textContent.trim();
            if (skillText && !skills.includes(skillText) && skillText.length > 1) {
              skills.push(skillText);
              console.log('Found skill:', skillText);
            }
          });
        });
      }

      // Also look for skills in the "About" section
      const aboutSelectors = [
        '#about',
        '[data-section="about"]',
        '.pv-about-section',
        '.pv-about__summary-text',
        '.pv-about__summary-text span',
        '.pv-about__summary-text p',
        '.pv-about__summary-text div',
        '.pv-profile-section.about-section',
        '.pv-profile-section.about-section .pv-about__summary-text'
      ];

      console.log('Looking for About section...');
      let aboutSection = null;
      for (const selector of aboutSelectors) {
        aboutSection = document.querySelector(selector);
        if (aboutSection) {
          console.log('Found About section with selector:', selector);
          break;
        }
      }
      
      if (aboutSection) {
        const aboutText = aboutSection.textContent.toLowerCase();
        console.log('About section text length:', aboutText.length);
        const techKeywords = [
          'javascript', 'python', 'java', 'react', 'angular', 'vue', 'node.js', 'express',
          'mongodb', 'mysql', 'postgresql', 'aws', 'azure', 'docker', 'kubernetes',
          'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'agile', 'scrum',
          'html', 'css', 'sass', 'less', 'typescript', 'php', 'ruby', 'go',
          'c++', 'c#', '.net', 'spring', 'django', 'flask', 'laravel', 'rails',
          'machine learning', 'ai', 'data science', 'sql', 'nosql', 'redis'
        ];
        
        techKeywords.forEach(keyword => {
          if (aboutText.includes(keyword) && !skills.includes(keyword)) {
            skills.push(keyword);
            console.log('Found keyword in About section:', keyword);
          }
        });
      } else {
        console.log('No About section found');
      }

      console.log('Total skills found:', skills.length);

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
      console.log('Looking for contact info...');
      
      // Check if contact info modal is open
      const contactModal = document.querySelector('.pv-contact-info__contact-type, .ci-v2-modal, .contact-info-modal');
      
      if (contactModal) {
        console.log('Found contact modal');
        // Extract email
        const emailElement = contactModal.querySelector('a[href^="mailto:"]');
        if (emailElement) {
          contactInfo.email = emailElement.href.replace('mailto:', '');
          console.log('Found email in modal:', contactInfo.email);
        }

        // Extract phone
        const phoneElement = contactModal.querySelector('a[href^="tel:"]');
        if (phoneElement) {
          contactInfo.phone = phoneElement.href.replace('tel:', '');
          console.log('Found phone in modal:', contactInfo.phone);
        }

        // Extract websites
        const websiteElements = contactModal.querySelectorAll('a[href^="http"]:not([href*="linkedin.com"])');
        console.log('Found', websiteElements.length, 'websites in modal');
        websiteElements.forEach(element => {
          const url = element.href;
          if (url && !contactInfo.websites.includes(url)) {
            contactInfo.websites.push(url);
            console.log('Found website in modal:', url);
          }
        });
      } else {
        console.log('No contact modal found, trying direct selectors...');
        
        // Try to find contact info directly on the page
        const emailElement = document.querySelector('a[href^="mailto:"]');
        if (emailElement) {
          contactInfo.email = emailElement.href.replace('mailto:', '');
          console.log('Found email directly:', contactInfo.email);
        } else {
          console.log('No email found');
        }

        const phoneElement = document.querySelector('a[href^="tel:"]');
        if (phoneElement) {
          contactInfo.phone = phoneElement.href.replace('tel:', '');
          console.log('Found phone directly:', contactInfo.phone);
        } else {
          console.log('No phone found');
        }

        const websiteElements = document.querySelectorAll('a[href^="http"]:not([href*="linkedin.com"])');
        console.log('Found', websiteElements.length, 'website links directly');
        websiteElements.forEach(element => {
          const url = element.href;
          if (url && !contactInfo.websites.includes(url)) {
            contactInfo.websites.push(url);
            console.log('Found website directly:', url);
          }
        });
      }

    } catch (error) {
      console.error('Error extracting contact info:', error);
    }

    console.log('Final contact info:', contactInfo);
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
