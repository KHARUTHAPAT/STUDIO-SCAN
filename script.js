// Geofencing and Announcement Logic (Pure Google Sheets API v4)
class GeofenceApp {
    constructor() {
        // UI Elements
        this.mainContainerWrapper = document.getElementById('mainContainerWrapper');
        this.mainMenuCard = document.getElementById('mainMenuCard');
        this.geofenceChecker = document.getElementById('geofenceChecker');
        this.menuButtonsContainer = document.getElementById('adminMenuButtons');
        
        this.statusTitle = document.getElementById('statusTitle');
        this.statusMessage = document.getElementById('statusMessage');
        this.statusIconContainer = document.getElementById('statusIcon');
        this.retryButton = document.getElementById('retryButton');
        this.pageTitle = document.getElementById('pageTitle');
        
        // Announcement Modal Elements
        this.announcementModalOverlay = document.getElementById('announcementModalOverlay');
        this.announcementImage = document.getElementById('announcementImage');
        this.closeAnnouncementButton = document.getElementById('closeAnnouncementButton');
        this.countdownText = document.getElementById('countdownText'); 
        this.closeIcon = this.closeAnnouncementButton.querySelector('.close-icon'); 
        this.modalLoader = document.getElementById('modalLoader'); 
        
        // 🔴 NEW: เพิ่ม Modal Loader Text
        this.modalLoaderText = document.getElementById('modalLoaderText');
        // 🔴 REMOVED: ลบ this.textLoaderLine ออกจาก constructor
        
        // 🔴 NEW: Floating Footer Elements
        this.countdownFooter = document.getElementById('countdownFooter');
        this.countdownTimerText = document.getElementById('countdownTimerText');

        // NEW: Announcement Button Elements
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        // 🔴 NEW: Admin Auth Elements
        this.adminAuthModalOverlay = document.getElementById('adminAuthModalOverlay');
        this.adminPasscodeInput = document.getElementById('adminPasscodeInput');
        this.adminAuthButton = document.getElementById('adminAuthButton');
        this.adminAuthError = document.getElementById('adminAuthError');
        
        this.ADMIN_PASSCODE = 'admin123'; 
        
        // 🔴 FIX: ตรวจสอบสถานะล็อกอิน 5 นาที (300,000 มิลลิวินาที) จาก Local Storage
        const lastAuthTime = localStorage.getItem('admin_auth_time');
        this.isAdminAuthenticated = lastAuthTime && (Date.now() - parseInt(lastAuthTime) < 300000); 
        if (!this.isAdminAuthenticated) {
            localStorage.removeItem('admin_auth_time');
        }
        this.authCountdownInterval = null; // ตัวแปรสำหรับเก็บ Interval ของ Auth Timer

        // =================================================================
        // *** 🔴 PURE SHEETS API V4 CONFIGURATION 🔴 ***
        // =================================================================
        this.API_KEY = 'AIzaSyBivFhVOiCJdpVF4xNb7vYRNJLxLj60Rk0'; 
        this.SHEET_ID = '1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q'; 
        
        this.STUDIO_SHEET_NAME = 'Studio'; 
        this.CONFIG_SHEET_NAME = 'รวมข้อมูล'; 
        
        // 🔴 NEW: Base URL สำหรับรูปภาพประกาศ (ถ้าใช้ ibb.co)
        this.ANNOUNCEMENT_IMAGE_BASE_URL = 'https://i.ibb.co/';
        
        // 🔴 NEW: ตัวแปรสำหรับควบคุม Timeout 20 วินาที
        this.ANNOUNCEMENT_LOAD_TIMEOUT_SEC = 20; 
        this.loadTimeoutInterval = null; 
        
        // 🔴 NEW: ตัวแปรสำหรับควบคุม Timeout 5 วินาที (สำหรับแสดงผล Geofence Status)
        this.GEOFENCE_STATUS_DELAY_MS = 5000; 

        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.studioData = {}; 
        this.geofenceConfig = {}; 
        this.announcementConfig = {}; 
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        this.isBypassMode = false;
        this.bypassUrl = null; 
        
        this.announcementControl = {
            hideCloseBtn: false,
            countdownSec: 0
        };
        this.isAnnouncementActive = false;
        this.countdownInterval = null;

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        this.mainContainerWrapper.style.display = 'none'; 
        
        this.pageTitle.textContent = 'ประกาศ'; 
        
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc';
        
        document.body.style.overflow = 'hidden'; 

        this.init();
    }
    
    // --- Authentication Logic ---

    showAdminAuthModal() {
        // ตรวจสอบ Local Storage ก่อนแสดง Modal
        if (this.isAdminAuthenticated) {
            this.continueAppFlow(); // ถ้าล็อกอินแล้ว ไปเมนูเลย
            return;
        }
        
        this.adminAuthModalOverlay.style.display = 'flex';
        this.adminAuthModalOverlay.classList.add('show');
        this.adminPasscodeInput.value = ''; 
        this.adminPasscodeInput.focus();
    }
    
    hideAdminAuthModal(callback) {
        this.adminAuthModalOverlay.classList.remove('show');
        setTimeout(() => {
            this.adminAuthModalOverlay.style.display = 'none';
            if (callback) callback();
        }, 300);
    }
    
    checkAdminPasscode() {
        const inputCode = this.adminPasscodeInput.value.trim();
        if (inputCode === this.ADMIN_PASSCODE) {
            this.isAdminAuthenticated = true;
            // 🔴 FIX: บันทึก Timestamp ปัจจุบันลง Local Storage
            localStorage.setItem('admin_auth_time', Date.now().toString()); 
            
            this.adminAuthError.style.display = 'none';
            this.hideAdminAuthModal(() => {
                this.continueAppFlow(); // ไปที่หน้าเมนูหลัก
            });
        } else {
            this.adminAuthError.style.display = 'block';
            this.adminPasscodeInput.value = '';
            this.adminPasscodeInput.focus();
        }
    }

    init() {
        this.bindEvents();
        
        // 🔴 FIX 3: ล้างประวัติ (History) ทันที เมื่อเป็นหน้า Studio
        if (this.studioName) {
            this.clearInitialHistory();
        }
        
        // 1. โหลด Config ทั้งหมด (รวมถึงประกาศ) ก่อนเริ่ม Flow
        this.loadInitialConfig().then(() => {
             if (this.studioName) {
                 this.loadStudioFlow('geofence_check');
             } else {
                 // 🔴 FLOW ADMIN: โหลดประกาศเสมอ (Modal Auth จะถูกเรียกหลังปิดประกาศ)
                 const initialAction = 'main_menu';
                 const initialControl = { hideCloseBtn: false, countdownSec: 0 }; 
                 this.loadAnnouncement(initialAction, true, initialControl); 
             }
        }).catch(error => {
            console.error("Fatal Error during initial config load:", error);
            this.showErrorScreen(`ไม่สามารถโหลดข้อมูลเริ่มต้นได้: ${error.message}`);
        });
    }
    
    clearInitialHistory() {
        window.history.replaceState(null, null, window.location.href);
    }
    
    _setRetryToGeolocationCheck() {
        const newButton = this.retryButton.cloneNode(true);
        this.retryButton.parentNode.replaceChild(newButton, this.retryButton);
        this.retryButton = newButton; 
        
        this.retryButton.addEventListener('click', () => this.checkGeolocation());
        this.retryButton.querySelector('.button-text').textContent = 'ลองใหม่อีกครั้ง';
    }
    
    _onAnnouncementButtonClick = (event) => {
        const url = event.currentTarget.getAttribute('data-url');
        if (url) {
            window.open(url, '_blank');
        }
    }
    
    _shareStudioLink = (event) => {
        const itemContainer = event.currentTarget.closest('.studio-menu-item');
        const studioButton = itemContainer.querySelector('.neural-button');
        const name = studioButton.querySelector('.button-text').textContent;
        const url = `?studio=${encodeURIComponent(name)}`;
        const linkToShare = window.location.origin + window.location.pathname + url;
        
        if (navigator.share) {
            navigator.share({
                title: `ลิงก์เข้า Studio: ${name}`,
                text: `ใช้ลิงก์นี้เพื่อเข้าสู่ระบบ ${name}`,
                url: linkToShare
            }).catch(error => {
                console.error('Sharing failed', error);
                alert('ไม่สามารถเปิดเมนูแชร์ได้ (โปรดลองคัดลอกลิ้งค์แทน)');
            });
        } else {
            alert('เบราว์เซอร์ไม่รองรับฟังก์ชันแชร์โดยตรง โปรดใช้ปุ่มคัดลอกลิ้งค์');
        }
    }

    _copyStudioLink = (event) => {
        const itemContainer = event.currentTarget.closest('.studio-menu-item');
        const studioButton = itemContainer.querySelector('.neural-button');
        
        const name = studioButton.querySelector('.button-text').textContent;
        const url = `?studio=${encodeURIComponent(name)}`;
        const linkToCopy = window.location.origin + window.location.pathname + url;
        
        // 1. ลองใช้ Clipboard API (ต้องการ HTTPS)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(linkToCopy).then(() => {
                this._showCopyFeedback(event.currentTarget);
            }).catch(() => {
                // ถ้าล้มเหลว (เช่น ไม่ใช่ HTTPS/Permission ถูกจำกัด) ให้ไปใช้ Fallback
                this._fallbackCopy(linkToCopy, event.currentTarget);
            });
        } else {
            // 2. ใช้ Fallback Method (document.execCommand)
            this._fallbackCopy(linkToCopy, event.currentTarget);
        }
    }

    _showCopyFeedback(iconElement) {
        const icon = iconElement.querySelector('i');
        const originalIconClass = icon.className;
        const originalIconColor = icon.style.color;
        
        icon.className = 'fas fa-check';
        icon.style.color = '#10b981'; 
        
        setTimeout(() => {
             icon.className = originalIconClass;
             icon.style.color = originalIconColor;
        }, 1500);
    }

    bindEvents() {
        this._setRetryToGeolocationCheck(); 
        
        if (this.closeAnnouncementButton) {
            this.closeAnnouncementButton.addEventListener('click', () => this.closeAnnouncementModal());
        }
        
        if (this.adminAuthButton) {
            this.adminAuthButton.addEventListener('click', () => this.checkAdminPasscode());
        }
        if (this.adminPasscodeInput) {
            this.adminPasscodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkAdminPasscode();
                }
            });
        }
        
        this.announcementImage.addEventListener('load', () => { 
             // 🔴 เมื่อโหลดสำเร็จ: เคลียร์ Timeout
             if (this.loadTimeoutInterval) {
                 clearInterval(this.loadTimeoutInterval);
                 this.loadTimeoutInterval = null;
                 if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';
             }

             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'block';
             
             this.announcementModalOverlay.classList.remove('initial-show');
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);
        });

        this.announcementImage.addEventListener('error', () => {
             // 🔴 เมื่อโหลดล้มเหลว: เคลียร์ Timeout
             if (this.loadTimeoutInterval) {
                 clearInterval(this.loadTimeoutInterval);
                 this.loadTimeoutInterval = null;
                 if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';
             }
             
             this.modalLoader.style.display = 'none';
             
             this.announcementModalOverlay.classList.remove('initial-show');
             
             this.announcementImage.style.display = 'none'; 
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);

             if (this.announcementActionArea.style.display === 'none') { 
                 this.isAnnouncementActive = false;
                 if (postAction !== 'main_menu') this.closeAnnouncementModal();
             }
             console.error("Announcement Image failed to load or permission denied.");
        });
    }

    // =================================================================
    // *** 🟢 GOOGLE SHEETS API V4 FETCHERS (ALL DATA) 🟢 ***
    // =================================================================
    
    async fetchStudioListFromSheet() {
        const range = `${this.STUDIO_SHEET_NAME}!A:E`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${range}?key=${this.API_KEY}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Sheets API Error: ${errorData.error.message}`);
            }
            const data = await response.json();
            
            const list = {};
            const values = data.values || [];
            
            for (let i = 0; i < values.length; i++) {
                const row = values[i];
                const name = row[0] ? row[0].toString().trim() : '';
                const url = row[1] ? row[1].toString().trim() : '';
                const checkCondition = row[2];
                const hideCloseBtn = (row[3] == 1 || row[3] === '1');
                let countdownSec = parseInt(row[4]);
                
                if (isNaN(countdownSec) || countdownSec < 0) {
                    countdownSec = 0;
                }
                
                if (name && url) {
                    const requiresGeofence = (checkCondition == 1 || checkCondition === '1');
                    
                    list[name] = {
                        url: url,
                        check: requiresGeofence,
                        hideCloseBtn: hideCloseBtn, 
                        countdownSec: countdownSec 
                    };
                }
            }
            return list;
        } catch (error) {
            console.error('Error fetching Studio List:', error);
            throw new Error(`Failed to fetch studio list from Google Sheet: ${error.message}`);
        }
    }
    
    async fetchGeofenceConfigFromSheet() {
        const range = `${this.CONFIG_SHEET_NAME}!K1:K3`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${range}?key=${this.API_KEY}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                 const errorData = await response.json();
                throw new Error(`Sheets API Error: ${errorData.error.message}`);
            }
            const data = await response.json();
            
            const values = data.values || [];
            if (values.length < 3) {
                 throw new Error("Missing values for Geofence config (K1:K3).");
            }
            
            const lat = parseFloat(values[0][0]);
            const lon = parseFloat(values[1][0]);
            const radiusMeters = parseFloat(values[2][0]);

            if (isNaN(lat) || isNaN(lon) || isNaN(radiusMeters) || radiusMeters <= 0) {
                 throw new Error("Invalid Geofence configuration values (K1, K2, K3).");
            }
            
            return {
                lat: lat,
                lon: lon,
                dist: radiusMeters / 1000 // แปลงเป็นกิโลเมตร
            };
        } catch (error) {
            console.error('Error fetching Geofence Config:', error);
            throw new Error(`Failed to fetch Geofence config from Google Sheet: ${error.message}`);
        }
    }

    async fetchAnnouncementConfigFromSheet() {
        const range = `${this.CONFIG_SHEET_NAME}!H18:L18`; 
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${range}?key=${this.API_KEY}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                 const errorData = await response.json();
                throw new Error(`Sheets API Error: ${errorData.error.message}`);
            }
            const data = await response.json();
            
            const values = data.values && data.values[0] || [];
            
            // 🔴 FIX: ดึงเฉพาะ Image Suffix (ส่วนท้าย)
            const imageUrlSuffix = values[0] ? values[0].toString().trim() : ''; 
            
            const buttonText = values[3] ? values[3].toString().trim() : '';
            const buttonUrl = values[4] ? values[4].toString().trim() : '';
            
            const isValidUrl = buttonUrl.startsWith('http://') || buttonUrl.startsWith('https://');
            const isValidButton = buttonText && buttonUrl && isValidUrl;
            
            return {
                imageUrl: imageUrlSuffix, // 🔴 ส่ง Suffix กลับไป
                buttonText: isValidButton ? buttonText : '',
                buttonUrl: isValidButton ? buttonUrl : '',
                hasContent: imageUrlSuffix || isValidButton
            };
        } catch (error) {
            console.error('Error fetching Announcement Config:', error);
            return { hasContent: false };
        }
    }

    async loadInitialConfig() {
        const [studioList, geofenceConfig, announcementConfig] = await Promise.all([
            this.fetchStudioListFromSheet(),
            this.fetchGeofenceConfigFromSheet(),
            this.fetchAnnouncementConfigFromSheet()
        ]);
        
        this.studioData = studioList;
        this.geofenceConfig = geofenceConfig;
        this.announcementConfig = announcementConfig;
    }
    
    // --- App Flow Control ---

    async loadStudioFlow(action) {
        
        const studioEntry = this.studioData[this.studioName];
        
        if (!studioEntry) {
            alert("ไม่สามารถโหลดข้อมูล Studio ได้ หรือ Studio ไม่อยู่ในรายการ");
            window.location.href = window.location.origin + window.location.pathname; 
            return;
        }
        
        this.announcementControl = {
             hideCloseBtn: studioEntry.hideCloseBtn,
             countdownSec: studioEntry.countdownSec
        };
        
        this.target.url = studioEntry.url;
        this.isBypassMode = studioEntry.check === false;

        if (this.isBypassMode) {
             action = 'bypass_redirect';
             this.bypassUrl = studioEntry.url;
        } else {
             this.target.lat = this.geofenceConfig.lat;
             this.target.lon = this.geofenceConfig.lon;
             this.target.dist = this.geofenceConfig.dist;
        }
        
        this.loadAnnouncement(action, true, this.announcementControl); 
    }
    
    // 🔴 เมื่อเข้าถึงหน้า Menu สำเร็จ (หลังใส่รหัสผ่าน)
    continueAppFlow() {
        this.isBypassMode = false;
        this.bypassUrl = null;
        this.showMainMenu();
    }
    
    // --- UI/Mode Handlers ---

    showMainMenu() {
        document.body.classList.add('light-mode'); 
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc'; 
        
        this.mainContainerWrapper.style.display = 'flex'; 
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        
        document.body.style.overflow = 'auto'; 
        document.body.classList.add('menu-scrollable');
        
        this.mainMenuCard.style.marginTop = '0';
        document.getElementById('mainContainerWrapper').style.marginTop = '0';
        
        this.pageTitle.textContent = 'เมนู Studio'; 
        document.getElementById('menuTitle').textContent = 'เมนู Studio'; 
        document.getElementById('mainMenuCard').querySelector('p').textContent = 'เลือก Studio ที่ต้องการเข้าถึง';

        this.setupMenuButtons(Object.keys(this.studioData));
        
        // 🔴 NEW: เริ่มนับถอยหลังเมื่อเข้าสู่หน้า Menu Admin
        this.startAuthCountdownTimer(); 
    }

    showGeofenceChecker() {
        // 🔴 FIX: ถ้าเป็นหน้า Studio ให้แน่ใจว่าซ่อน Footer Countdown ไปด้วย
        if (this.authCountdownInterval) clearInterval(this.authCountdownInterval);
        if (this.countdownFooter) this.countdownFooter.style.display = 'none';
        
        // 🔴 FIX 1: ตัดกล่องสี่เหลี่ยมว่างเปล่า 
        this.mainContainerWrapper.style.display = 'none'; 
        document.body.style.overflow = 'hidden'; 
        document.body.classList.remove('menu-scrollable');
        
        // ให้หน่วงเวลาเล็กน้อยเพื่อให้หน้าจอว่าง ก่อนแสดง Geofence Checker
        setTimeout(() => {
            document.body.classList.add('light-mode'); 
            document.body.classList.remove('dark-mode'); 
            this.mainContainerWrapper.style.display = 'flex'; 
            this.mainMenuCard.style.display = 'none';
            this.geofenceChecker.style.display = 'flex';
            this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;

            this.mainMenuCard.style.marginTop = '';
            document.getElementById('mainContainerWrapper').style.marginTop = '';
        }, 50); 
    }
    
    // 🔴 NEW: Setup Menu Buttons (รวมปุ่มคัดลอก/แชร์ลิ้งค์)
    setupMenuButtons(studioNames) {
        this.menuButtonsContainer.innerHTML = ''; 
        
        studioNames.forEach(name => {
            const url = `?studio=${encodeURIComponent(name)}`;
            const fullLink = window.location.origin + window.location.pathname + url;
            
            // 1. สร้าง Container สำหรับปุ่ม + ไอคอน
            const itemContainer = document.createElement('div');
            itemContainer.className = 'studio-menu-item';
            
            // 2. สร้างปุ่ม Studio
            const studioButton = document.createElement('button');
            studioButton.className = 'neural-button';
            studioButton.type = 'button';
            
            studioButton.innerHTML = `
                <div class="button-bg"></div>
                <span class="button-text">${name}</span> 
                <div class="button-glow"></div>
            `;

            studioButton.addEventListener('click', () => {
                window.open(fullLink, '_blank'); 
            });
            
            itemContainer.appendChild(studioButton);
            
            // 3. สร้างกลุ่มปุ่ม Action (แถบติดกัน)
            const actionStrip = document.createElement('div');
            actionStrip.className = 'icon-action-strip';
            
            // 3a. ปุ่มแชร์
            const shareButton = document.createElement('button');
            shareButton.className = 'neural-button share-button';
            shareButton.type = 'button';
            shareButton.innerHTML = `<span class="button-text"><i class="fas fa-share-alt"></i> แชร์</span>`;
            shareButton.addEventListener('click', this._shareStudioLink);
            actionStrip.appendChild(shareButton);
            
            // 3b. ปุ่มคัดลอก
            const copyButton = document.createElement('button');
            copyButton.className = 'neural-button copy-button';
            copyButton.type = 'button';
            copyButton.innerHTML = `<span class="button-text"><i class="far fa-copy"></i> คัดลอกลิ้งค์</span>`;
            copyButton.addEventListener('click', this._copyStudioLink);
            actionStrip.appendChild(copyButton);

            itemContainer.appendChild(actionStrip);
            
            this.menuButtonsContainer.appendChild(itemContainer);
        });
    }

    // --- Announcement Logic (Pure Sheets API) ---

    // 🔴 NEW FUNCTION: จัดการการนับถอยหลังโหลด 20 วินาที (ไม่มีแถบโหลด)
    startLoadCountdown(action) {
        let remaining = this.ANNOUNCEMENT_LOAD_TIMEOUT_SEC;
        
        if (this.loadTimeoutInterval) {
             clearInterval(this.loadTimeoutInterval);
        }
        
        if (this.modalLoaderText) {
             this.modalLoaderText.style.display = 'block';
             this.modalLoaderText.style.color = '#f8fafc';
        }
        
        this.loadTimeoutInterval = setInterval(() => {
            if (this.modalLoaderText) {
                // 🔴 NEW: แสดงผล "กำลังโหลด (X)"
                this.modalLoaderText.textContent = `กำลังโหลด (${remaining})`; 
            }
            remaining--;

            if (remaining < 0) {
                clearInterval(this.loadTimeoutInterval);
                this.loadTimeoutInterval = null;
                
                // 🔴 ถ้าโหลดไม่เสร็จภายใน 20 วิ: ให้ถือว่าเสร็จสิ้นและไปต่อ 🔴
                if (this.announcementModalOverlay.classList.contains('show')) {
                     console.warn("Announcement timed out after 20s. Continuing flow.");
                     
                     // 1. ซ่อน Loader และ text
                     this.modalLoader.style.display = 'none';
                     if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';

                     // 2. หากยังไม่มีภาพ (แสดงว่าโหลดไม่ทัน) ให้ไปควบคุมปุ่มปิดเลย
                     if (this.announcementImage.style.display === 'none') {
                         this.startCloseButtonControl(action);
                     }
                }
            }
        }, 1000);
    }

    // 🔴 NEW FUNCTION: เริ่มนับถอยหลังสำหรับสถานะล็อกอิน 5 นาที
    startAuthCountdownTimer() {
        if (this.authCountdownInterval) {
            clearInterval(this.authCountdownInterval);
        }
        
        const MAX_AGE = 300000; // 5 นาที
        const authTime = parseInt(localStorage.getItem('admin_auth_time'));
        
        if (!authTime || !this.isAdminAuthenticated) {
            this.countdownFooter.style.display = 'none';
            return;
        }

        this.countdownFooter.style.display = 'block';

        const updateTimer = () => {
            const timeElapsed = Date.now() - authTime;
            const timeRemaining = MAX_AGE - timeElapsed;

            if (timeRemaining <= 0) {
                clearInterval(this.authCountdownInterval);
                this.isAdminAuthenticated = false;
                localStorage.removeItem('admin_auth_time');
                this.countdownFooter.style.display = 'none';
                
                // 🔴 แจ้งเตือนและบังคับให้กลับไปล็อกอินถ้าผู้ใช้ยังอยู่หน้า Menu
                if (this.mainMenuCard.style.display === 'flex') {
                    alert('เซสชัน Admin หมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
                    this.showAdminAuthModal();
                }
                return;
            }

            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            this.countdownTimerText.textContent = `เซสชัน Admin จะหมดอายุใน ${formattedTime} นาที`;
        };

        updateTimer();
        this.authCountdownInterval = setInterval(updateTimer, 1000);
    }

    async loadAnnouncement(action, isInitialLoad = false, control = null) {
        
        if (control) {
             this.announcementControl = control;
        }

        if (!this.announcementModalOverlay) {
             this.startCloseButtonControl(action);
             return;
        }
        
        this.isAnnouncementActive = true; 
        this.closeAnnouncementButton.style.display = 'none'; 
        this.countdownText.style.display = 'none'; 
        this.closeIcon.style.display = 'none';

        // เคลียร์ Interval เก่าก่อนเริ่ม
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        // 🔴 NEW: เคลียร์ Load Timeout Interval เก่าก่อนเริ่ม
        if (this.loadTimeoutInterval) {
             clearInterval(this.loadTimeoutInterval);
             this.loadTimeoutInterval = null;
        }

        if (!isInitialLoad) {
            this.announcementModalOverlay.classList.remove('show', 'initial-show');
            this.announcementModalOverlay.style.display = 'none';
        }
        
        this.announcementImage.style.display = 'none';
        this.announcementActionArea.style.display = 'none'; 

        this.announcementModalOverlay.setAttribute('data-post-action', action);
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        const result = this.announcementConfig;
        
        // 🔴 FIX: ประกอบ URL รูปภาพที่สมบูรณ์
        let fullImageUrl = '';
        if (result.imageUrl && result.imageUrl.trim() !== '') {
            fullImageUrl = this.ANNOUNCEMENT_IMAGE_BASE_URL + result.imageUrl.trim();
        }
        
        const hasImage = fullImageUrl !== '';
        const hasButton = result.buttonText && result.buttonUrl; 
        
        if (!result.hasContent) {
            this.isAnnouncementActive = false; 
            this.startCloseButtonControl(action);
            return;
        }


        if (isInitialLoad) {
            this.announcementModalOverlay.style.display = 'flex'; 
            this.modalLoader.style.display = 'flex';
            this.announcementModalOverlay.classList.add('show', 'initial-show');
        } else {
            this.announcementModalOverlay.style.display = 'flex'; 
            this.modalLoader.style.display = 'flex';
            setTimeout(() => {
                 this.announcementModalOverlay.classList.add('show');
            }, 50);
        }
        
        // 🔴 NEW: เริ่มนับถอยหลัง Load Timeout 20 วินาที
        this.startLoadCountdown(action); 
        
        if (hasImage) {
            this.announcementImage.src = fullImageUrl; 
        } else {
            this.modalLoader.style.display = 'none'; 
            if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';
            this.announcementModalOverlay.classList.remove('initial-show'); 
            this.startCloseButtonControl(action); 
        }
        
        if (hasButton) {
            this.announcementActionArea.style.display = 'block';
            this.announcementActionButton.style.display = 'flex';
            this.announcementActionButton.querySelector('.button-text').textContent = result.buttonText.trim();
            this.announcementActionButton.setAttribute('data-url', result.buttonUrl.trim());
            this.announcementActionButton.addEventListener('click', this._onAnnouncementButtonClick);
        }
    }
    
    // --- Close Button Control ---
    startCloseButtonControl(action) {
        if (!this.announcementModalOverlay) {
             if (action === 'geofence_check') { this.showGeofenceChecker(); this.checkGeolocation(); } 
             else if (action === 'bypass_redirect') { window.open(this.bypassUrl, '_self'); } 
             else { this.continueAppFlow(); }
             return;
        }
        
        this.announcementModalOverlay.setAttribute('data-post-action', action);
        
        if (!this.isAnnouncementActive) {
             if (action === 'geofence_check') { this.showGeofenceChecker(); this.checkGeolocation(); } 
             else if (action === 'bypass_redirect') { window.open(this.bypassUrl, '_self'); } 
             else { this.continueAppFlow(); }
             return;
        }
        
        if (this.announcementControl.hideCloseBtn) {
            this.closeAnnouncementButton.style.display = 'none';
            this.countdownText.style.display = 'none';
            this.closeIcon.style.display = 'none';
            
        } else if (this.announcementControl.countdownSec > 0) {
            let remaining = this.announcementControl.countdownSec;
            
            this.closeAnnouncementButton.style.display = 'flex'; 
            this.closeIcon.style.display = 'none'; // ซ่อนกากบาท
            this.countdownText.style.display = 'block'; 

            // 🔴 FIX 2: ปิด Event Listener ชั่วคราวเมื่อนับถอยหลัง (ไม่ให้คลิกได้)
            this.closeAnnouncementButton.style.pointerEvents = 'none';
            
            this.countdownInterval = setInterval(() => {
                this.countdownText.textContent = remaining; 
                remaining--;

                if (remaining < 0) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                    
                    this.countdownText.style.display = 'none'; 
                    this.closeIcon.style.display = 'block'; 
                    
                    // 🔴 FIX 2: เปิด Event Listener เมื่อนับเสร็จ
                    this.closeAnnouncementButton.style.pointerEvents = 'auto';
                }
            }, 1000);
            
        } else {
            this.closeAnnouncementButton.style.display = 'flex'; 
            this.closeIcon.style.display = 'block';
            this.countdownText.style.display = 'none';
            this.closeAnnouncementButton.style.pointerEvents = 'auto'; // เปิดใช้งานปกติ
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show', 'initial-show');
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        // 🔴 NEW: เคลียร์ Load Timeout Interval ด้วย
        if (this.loadTimeoutInterval) {
             clearInterval(this.loadTimeoutInterval);
             this.loadTimeoutInterval = null;
        }
        if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';


        this.isAnnouncementActive = false;
        
        const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
        
        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';
            this.countdownText.style.display = 'none'; 
            
            if (postAction === 'bypass_redirect' && this.bypassUrl) {
                window.open(this.bypassUrl, '_self'); 
            } else if (postAction === 'geofence_check') {
                this.showGeofenceChecker();
                this.checkGeolocation();
            } else if (postAction === 'main_menu') {
                // 🔴 FIX 4: เมื่อปิดประกาศในหน้าหลัก: ตรวจสอบ/เรียก Modal Auth 
                this.showAdminAuthModal();
            }
        }, 300); 
    }

    // --- Geofencing Logic (with 5-second delay and Retry Fix) ---

    checkGeolocation() {
        this._setRetryToGeolocationCheck(); 
        
        if (this.target.lat === null) {
             this.updateStatus('error', 'การตั้งค่า Geofence ผิดพลาด', 'ไม่พบพิกัดเป้าหมาย (โปรดตรวจสอบ K1-K3)');
             // 🔴 FIX: ใช้ delay ก่อนแสดงปุ่ม Retry
             setTimeout(() => {
                 this.retryButton.style.display = 'flex';
             }, this.GEOFENCE_STATUS_DELAY_MS);
             return;
        }
        
        // 1. แสดงสถานะ Loading ทันที
        this.updateStatus('loading', `กำลังตรวจสอบตำแหน่ง ${this.studioName}...`, 'โปรดอนุญาตการเข้าถึง GPS เพื่อดำเนินการต่อ');
        this.retryButton.style.display = 'none'; 

        // 🔴 FIX 4: เพิ่ม setTimeout 100ms ก่อนเรียก GPS API (ลดดีเลย์)
        setTimeout(() => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => this.geoSuccess(position),
                    (error) => this.geoError(error), 
                    // 🟢 FIX 5: ตั้งค่า maximumAge เป็น 5 นาที (300000ms) เพื่ออนุญาตให้ใช้ Cache
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 } 
                );
            } else {
                this.updateStatus('error', 'เบราว์เซอร์ไม่รองรับ', 'โทรศัพท์ของคุณไม่รองรับ Geolocation หรือไม่ได้เปิด GPS');
                // 🔴 FIX: ใช้ delay ก่อนแสดงปุ่ม Retry
                setTimeout(() => {
                    this.retryButton.style.display = 'flex';
                }, this.GEOFENCE_STATUS_DELAY_MS);
            }
        }, 100); 
    }
    
    geoSuccess(position) {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const distance = this.calculateDistance(this.target.lat, this.target.lon, userLat, userLon);
        const distanceMeters = (distance * 1000).toFixed(0);

        if (distance <= this.target.dist) {
            this.updateStatus('success', 'ยืนยันตำแหน่งสำเร็จ!', `ระยะทาง: ${distanceMeters} เมตร (นำไปสู่แบบฟอร์ม...)`);
            // 🔴 NEW: หน่วงเวลา 5 วินาทีก่อนเปลี่ยนหน้า
            setTimeout(() => {
                 window.open(this.target.url, '_self'); 
            }, this.GEOFENCE_STATUS_DELAY_MS);

        } else {
            const maxMeters = this.target.dist * 1000;
            this.updateStatus('error', 'เข้าถึงถูกปฏิเสธ', `คุณอยู่ห่าง ${distanceMeters} เมตร (เกิน ${maxMeters} เมตร) โปรดลองใหม่อีกครั้งในพื้นที่ที่กำหนด`);
            
            // 🔴 NEW: หน่วงเวลา 5 วินาทีก่อนแสดงปุ่ม Retry
            setTimeout(() => {
                this.retryButton.style.display = 'flex';
            }, this.GEOFENCE_STATUS_DELAY_MS);
        }
    }
    
    geoError(error) {
        let errorMessage = 'ไม่สามารถเข้าถึงตำแหน่ง GPS ได้';
        let customMessage = 'โปรดตรวจสอบว่าได้เปิด GPS และอนุญาตการเข้าถึงตำแหน่งสำหรับเว็บไซต์นี้';

        this._setRetryToGeolocationCheck(); 

        if (error.code === 1) {
            errorMessage += ' (ถูกปฏิเสธ)';
        } else if (error.code === 2) {
            errorMessage += ' (ไม่พบตำแหน่ง)';
        } else if (error.code === 3) {
            errorMessage += ' (หมดเวลาค้นหา)';
        }
        
        this.updateStatus('error', errorMessage, customMessage);
        
        // 🔴 NEW: หน่วงเวลา 5 วินาทีก่อนแสดงปุ่ม Retry
        setTimeout(() => {
            this.retryButton.style.display = 'flex'; 
        }, this.GEOFENCE_STATUS_DELAY_MS);
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        function toRad(Value) { return Value * Math.PI / 180; }
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const lat1Rad = toRad(lat1);
        const lat2Rad = toRad(lat2);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
        return R * c;
    }

    updateStatus(type, title, message) {
        this.geofenceChecker.classList.remove('loading', 'error', 'success');
        this.geofenceChecker.classList.add(type);

        this.statusTitle.textContent = title;
        this.statusMessage.textContent = message;
        
        if (type === 'loading') {
            this.statusIconContainer.innerHTML = '<div class="circle-loader-spin"></div>';
            this.retryButton.style.display = 'none';
        } else if (type === 'error') {
            this.statusIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            this.retryButton.style.display = 'none'; // ซ่อนไว้ก่อนแสดง delay
        } else if (type === 'success') {
            this.statusIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            this.retryButton.style.display = 'none';
        }
    }
    
    showErrorScreen(message) {
         document.body.style.overflow = 'auto'; 
         this.geofenceChecker.style.display = 'flex';
         this.mainContainerWrapper.style.display = 'flex';
         this.mainMenuCard.style.display = 'none';
         this.updateStatus('error', 'ข้อผิดพลาดร้ายแรง', message);
         this.retryButton.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GeofenceApp();
});
