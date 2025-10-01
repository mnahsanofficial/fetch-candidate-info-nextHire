// Content Script for LinkedIn Contact Extractor
// Extracts visible profile data from LinkedIn DOM

(function() {
  'use strict';

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractProfileData') {
      (async () => {
        try {
          console.log('Content script received extractProfileData request');
          const profileData = await extractLinkedInProfileData();
          console.log('Extracted profile data:', profileData);
          sendResponse({ success: true, data: profileData });
        } catch (error) {
          console.error('Error in content script:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
    }
    return true; // Keep message channel open for async response
  });

  // Log that content script is loaded
  console.log('LinkedIn Contact Extractor content script loaded');

  /**
   * Extract profile data from LinkedIn DOM
   * Only extracts visible data, never hidden fields
   */
  async function extractLinkedInProfileData() {
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
      
      // Extract contact info (now async - will try to open modal)
      profileData.contactInfo = await extractContactInfo();

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
        console.log('Experience section HTML:', experienceSection.innerHTML.substring(0, 500));
        
        // Find all experience entries
        const experienceEntries = experienceSection.querySelectorAll('.pv-entity__date-range, .pvs-entity__caption-wrapper, .pv-entity__dates, .experience-item__duration, .pv-entity__summary-info-v2 .pv-entity__dates');
        console.log('Found', experienceEntries.length, 'experience entries in section');
        
        // If no entries found, try to find any elements with date-like content
        if (experienceEntries.length === 0) {
          console.log('No experience entries found, looking for any date-like elements...');
          const allElements = experienceSection.querySelectorAll('*');
          allElements.forEach(element => {
            const text = element.textContent.trim();
            if (text && (text.includes('202') || text.includes('year') || text.includes('month') || text.includes('present') || text.includes('current'))) {
              console.log('Found potential date element:', text, 'in', element.tagName, element.className);
              const months = parseExperienceDuration(text);
              if (months > 0) {
                totalMonths += months;
                console.log('Added', months, 'months from:', text);
              }
            }
          });
        } else {
          experienceEntries.forEach(entry => {
            const dateText = entry.textContent;
            const months = parseExperienceDuration(dateText);
            totalMonths += months;
          });
        }
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
          '.pv-profile-section .pvs-entity__caption-wrapper',
          // Additional current LinkedIn selectors
          '.pvs-entity__caption-wrapper',
          '.pvs-entity__caption-wrapper .t-14',
          '.pvs-entity__caption-wrapper .t-12',
          '.pv-entity__date-range .t-14',
          '.pv-entity__date-range .t-12',
          '.pv-entity__dates .t-14',
          '.pv-entity__dates .t-12'
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
        console.log('Skills section HTML:', skillsSection.innerHTML.substring(0, 500));
        
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
        
        // If no skills found with selectors, try to find any text that looks like skills
        if (skills.length === 0) {
          console.log('No skills found with selectors, looking for any skill-like text...');
          const allElements = skillsSection.querySelectorAll('*');
          allElements.forEach(element => {
            const text = element.textContent.trim();
            if (text && text.length > 2 && text.length < 50 && !text.includes(' ') && 
                (text.includes('Script') || text.includes('Java') || text.includes('Python') || 
                 text.includes('React') || text.includes('Node') || text.includes('SQL') ||
                 text.includes('HTML') || text.includes('CSS') || text.includes('Git'))) {
              console.log('Found potential skill:', text, 'in', element.tagName, element.className);
              if (!skills.includes(text)) {
                skills.push(text);
              }
            }
          });
        }
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
        console.log('About section text:', aboutSection.textContent);
        console.log('About section HTML:', aboutSection.innerHTML.substring(0, 500));
        
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
  async function extractContactInfo() {
    const contactInfo = {
      email: '',
      phone: '',
      websites: []
    };

    try {
      console.log('Looking for contact info...');
      
      // Strategy 1: Try to find and click the contact info button
      const contactButtonSelectors = [
        'button[aria-label*="Contact info"]',
        'button[aria-label*="Contact"]',
        '.pv-s-profile-actions__action--contact',
        '.pv-s-profile-actions__action',
        'button[data-control-name="contact_see_more"]',
        '.pv-s-profile-actions button',
        'button[data-control-name="contact_see_more"]',
        'button[aria-label*="contact"]',
        // Additional selectors for current LinkedIn
        'button[data-control-name="contact_see_more"]',
        '.pv-s-profile-actions__action--contact',
        'button[aria-label*="Show contact info"]',
        'button[aria-label*="View contact info"]',
        'button[aria-label*="See contact info"]',
        // Try to find any button with "contact" in text
        'button:has-text("Contact")',
        'a:has-text("Contact")',
        // More specific selectors
        '.pv-s-profile-actions__action[data-control-name="contact_see_more"]',
        '.pv-s-profile-actions__action--contact[data-control-name="contact_see_more"]'
      ];

      let contactButton = null;
      for (const selector of contactButtonSelectors) {
        try {
          contactButton = document.querySelector(selector);
          if (contactButton) {
            console.log('Found contact button with selector:', selector);
            break;
          }
        } catch (e) {
          // Skip invalid selectors
          continue;
        }
      }

      // If no button found with selectors, try to find by text content
      if (!contactButton) {
        console.log('No contact button found with selectors, searching by text...');
        const allButtons = document.querySelectorAll('button, a');
        for (const button of allButtons) {
          const text = button.textContent.toLowerCase();
          if (text.includes('contact') && (text.includes('info') || text.includes('see') || text.includes('view'))) {
            contactButton = button;
            console.log('Found contact button by text:', text);
            break;
          }
        }
      }

      if (contactButton) {
        console.log('Clicking contact info button...');
        try {
          // Try multiple click methods
          contactButton.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // If modal didn't open, try dispatching events
          if (!document.querySelector('.pv-contact-info__contact-type, .ci-v2-modal, .contact-info-modal')) {
            console.log('Modal not opened, trying dispatch events...');
            contactButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Try focus and enter key
          if (!document.querySelector('.pv-contact-info__contact-type, .ci-v2-modal, .contact-info-modal')) {
            console.log('Trying focus and enter key...');
            contactButton.focus();
            contactButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (e) {
          console.log('Error clicking contact button:', e);
        }
      } else {
        console.log('No contact button found');
        
        // Strategy: Try to find and click any element that might open contact info
        console.log('Trying to find contact info by searching all clickable elements...');
        const clickableElements = document.querySelectorAll('button, a, [role="button"], [onclick]');
        for (const element of clickableElements) {
          const text = element.textContent.toLowerCase();
          const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
          const title = element.getAttribute('title')?.toLowerCase() || '';
          
          if ((text.includes('contact') || ariaLabel.includes('contact') || title.includes('contact')) &&
              (text.includes('info') || ariaLabel.includes('info') || title.includes('info'))) {
            console.log('Found potential contact element:', text, ariaLabel, title);
            try {
              element.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              break;
            } catch (e) {
              console.log('Error clicking potential contact element:', e);
            }
          }
        }
      }

      // Check if contact info modal is open
      const contactModalSelectors = [
        '.pv-contact-info__contact-type',
        '.ci-v2-modal',
        '.contact-info-modal',
        '.pv-contact-info',
        '.pv-contact-info__contact-type',
        '[data-test-id="contact-info-modal"]',
        '.pv-contact-info__contact-type',
        '.pv-contact-info__contact-type .pv-contact-info__contact-type'
      ];

      let contactModal = null;
      for (const selector of contactModalSelectors) {
        contactModal = document.querySelector(selector);
        if (contactModal) {
          console.log('Found contact modal with selector:', selector);
          break;
        }
      }
      
      if (contactModal) {
        console.log('Extracting from contact modal...');
        
        // Extract email - try multiple selectors
        const emailSelectors = [
          'a[href^="mailto:"]',
          '.pv-contact-info__contact-type a[href^="mailto:"]',
          '.ci-v2-modal a[href^="mailto:"]',
          '.contact-info-modal a[href^="mailto:"]',
          'a[href*="mailto:"]'
        ];

        for (const selector of emailSelectors) {
          const emailElement = contactModal.querySelector(selector);
          if (emailElement) {
            contactInfo.email = emailElement.href.replace('mailto:', '');
            console.log('Found email in modal:', contactInfo.email);
            break;
          }
        }

        // Extract phone - try multiple selectors
        const phoneSelectors = [
          'a[href^="tel:"]',
          '.pv-contact-info__contact-type a[href^="tel:"]',
          '.ci-v2-modal a[href^="tel:"]',
          '.contact-info-modal a[href^="tel:"]',
          'a[href*="tel:"]'
        ];

        for (const selector of phoneSelectors) {
          const phoneElement = contactModal.querySelector(selector);
          if (phoneElement) {
            contactInfo.phone = phoneElement.href.replace('tel:', '');
            console.log('Found phone in modal:', contactInfo.phone);
            break;
          }
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
        
        // Strategy 2: Try to find contact info directly on the page
        const emailElement = document.querySelector('a[href^="mailto:"]');
        if (emailElement) {
          contactInfo.email = emailElement.href.replace('mailto:', '');
          console.log('Found email directly:', contactInfo.email);
        } else {
          console.log('No email found directly');
        }

        const phoneElement = document.querySelector('a[href^="tel:"]');
        if (phoneElement) {
          contactInfo.phone = phoneElement.href.replace('tel:', '');
          console.log('Found phone directly:', contactInfo.phone);
        } else {
          console.log('No phone found directly');
        }

        // Strategy 3: Try to find contact info in hidden elements or data attributes
        console.log('Searching for hidden contact info...');
        const allElements = document.querySelectorAll('*');
        for (const element of allElements) {
          const text = element.textContent;
          
          // Look for email patterns
          const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          if (emailMatch && !contactInfo.email) {
            contactInfo.email = emailMatch[1];
            console.log('Found email in text:', contactInfo.email);
          }
          
          // Look for phone patterns (various formats)
          const phoneMatch = text.match(/(\+?[\d\s\-\(\)]{10,})/);
          if (phoneMatch && !contactInfo.phone) {
            const phone = phoneMatch[1].replace(/[\s\-\(\)]/g, '');
            if (phone.length >= 10 && phone.length <= 15) {
              contactInfo.phone = phoneMatch[1];
              console.log('Found phone in text:', contactInfo.phone);
            }
          }
        }

        // Strategy 4: Try to find contact info in data attributes
        console.log('Searching data attributes for contact info...');
        const elementsWithData = document.querySelectorAll('[data-email], [data-phone], [data-contact-email], [data-contact-phone]');
        elementsWithData.forEach(element => {
          const email = element.getAttribute('data-email') || element.getAttribute('data-contact-email');
          const phone = element.getAttribute('data-phone') || element.getAttribute('data-contact-phone');
          
          if (email && !contactInfo.email) {
            contactInfo.email = email;
            console.log('Found email in data attribute:', contactInfo.email);
          }
          
          if (phone && !contactInfo.phone) {
            contactInfo.phone = phone;
            console.log('Found phone in data attribute:', contactInfo.phone);
          }
        });

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
