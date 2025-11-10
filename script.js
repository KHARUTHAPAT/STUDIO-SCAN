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
        
        // NEW: Announcement Button Elements
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        // =================================================================
        // *** 🔴 PURE SHEETS API V4 CONFIGURATION 🔴 ***
        // =================================================================
        // API Key ที่ผู้ใช้ให้มา
        this.API_KEY = 'AIzaSyBivFhVOiCJdpVF4xNb7vYRNJLxLj60Rk0'; 
        // Sheet ID
        this.SHEET_ID = '1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q'; 
        
        // *** ลบ this.WEB_APP_URL ออก เพราะไม่ใช้แล้ว ***
        
        this.STUDIO_SHEET_NAME = 'Studio'; 
        this.CONFIG_SHEET_NAME = 'รวมข้อมูล'; 
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.studioData = {}; 
        this.geofenceConfig = {}; 
        this.announcementConfig = {}; // NEW: เก็บค่าประกาศ
        
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
        
        this.closeAnnouncementButton.style.display = 'none'; 
        
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc';
        
        document.body.style.overflow = 'hidden'; 

        this.init();
    }

    init() {
        this.bindEvents();
        
        // 1. โหลด Config ทั้งหมด (รวมถึงประกาศ) ก่อนเริ่ม Flow
        this.loadInitialConfig().then(() => {
             if (this.studioName) {
                 this.loadStudioFlow('geofence_check');
             } else {
                 const initialAction = 'main_menu';
                 // ใช้ค่าควบคุมเริ่มต้นสำหรับ Menu (Admin)
                 const initialControl = { hideCloseBtn: false, countdownSec: 0 }; 
                 
                 // NEW: เรียก loadAnnouncement ที่ดึงจาก Sheets API
                 this.loadAnnouncement(initialAction, true, initialControl); 
             }
        }).catch(error => {
            console.error("Fatal Error during initial config load:", error);
            this.showErrorScreen(`ไม่สามารถโหลดข้อมูลเริ่มต้นได้: ${error.message}`);
        });
    }
    
    _onAnnouncementButtonClick = (event) => {
        const url = event.currentTarget.getAttribute('data-url');
        if (url) {
            window.open(url, '_blank');
        }
    }

    bindEvents() {
        this.retryButton.addEventListener('click', () => this.checkGeolocation());
        
        if (this.closeAnnouncementButton) {
            this.closeAnnouncementButton.addEventListener('click', () => this.closeAnnouncementModal());
        }
        
        // เมื่อภาพโหลดเสร็จ (สำเร็จ)
        this.announcementImage.addEventListener('load', () => { 
             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'block';
             
             this.announcementModalOverlay.classList.remove('initial-show');
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);
        });

        // เมื่อภาพโหลดเสร็จ (ล้มเหลว)
        this.announcementImage.addEventListener('error', () => {
             this.modalLoader.style.display = 'none';
             
             this.announcementModalOverlay.classList.remove('initial-show');
             
             this.announcementImage.style.display = 'none'; 
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);

             // ตรวจสอบเงื่อนไขการปิด Modal (ไม่มีรูป และไม่มีปุ่ม)
             if (this.announcementActionArea.style.display === 'none') { 
                 this.isAnnouncementActive = false;
                 this.closeAnnouncementModal(); 
             }
             console.error("Announcement Image failed to load or permission denied.");
        });
    }

    // =================================================================
    // *** 🟢 GOOGLE SHEETS API V4 FETCHERS (ALL DATA) 🟢 ***
    // =================================================================
    
    // ดึงค่าทั้งหมดจากชีต Studio
    async fetchStudioListFromSheet() {
        const range = `${this.STUDIO_SHEET_NAME}!A:E`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${range}?key=${this.API_KEY}`;
        // ... (Logic ดึง Studio List เดิม)
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
    
    // ดึงค่า Geofence Config (K1:K3)
    async fetchGeofenceConfigFromSheet() {
        const range = `${this.CONFIG_SHEET_NAME}!K1:K3`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${range}?key=${this.API_KEY}`;
        // ... (Logic ดึง Geofence Config เดิม)
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

    // NEW FUNCTION: ดึงค่า Announcement Config (H18, K18, L18)
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
            
            // H18: Image URL (index 0)
            const imageUrl = values[0] ? values[0].toString().trim() : ''; 
            // K18: Button Text (index 3)
            const buttonText = values[3] ? values[3].toString().trim() : '';
            // L18: Button URL (index 4)
            const buttonUrl = values[4] ? values[4].toString().trim() : '';
            
            const isValidUrl = buttonUrl.startsWith('http://') || buttonUrl.startsWith('https://');
            const isValidButton = buttonText && buttonUrl && isValidUrl;
            
            return {
                imageUrl: imageUrl,
                buttonText: isValidButton ? buttonText : '',
                buttonUrl: isValidButton ? buttonUrl : '',
                hasContent: imageUrl || isValidButton
            };
        } catch (error) {
            console.error('Error fetching Announcement Config:', error);
            // ไม่ต้อง Throw error รุนแรง ให้ return ว่าไม่มี Content
            return { hasContent: false };
        }
    }

    // ดึงข้อมูลหลักทั้งหมด (Studio List, Geofence Config, Announcement Config)
    async loadInitialConfig() {
        const [studioList, geofenceConfig, announcementConfig] = await Promise.all([
            this.fetchStudioListFromSheet(),
            this.fetchGeofenceConfigFromSheet(),
            this.fetchAnnouncementConfigFromSheet() // NEW: ดึงประกาศ
        ]);
        
        this.studioData = studioList;
        this.geofenceConfig = geofenceConfig;
        this.announcementConfig = announcementConfig; // NEW: เก็บค่าประกาศ
    }
    
    // --- App Flow Control ---

    async loadStudioFlow(action) {
        // ... (Flow เดิม)
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
    
    continueAppFlow() {
        this.isBypassMode = false;
        this.bypassUrl = null;
        this.showMainMenu();
    }
    
    // --- UI/Mode Handlers ---
    // ... (showMainMenu, showGeofenceChecker, setupMenuButtons เหมือนเดิม)
    
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
    }

    showGeofenceChecker() {
        document.body.classList.add('light-mode'); 
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc'; 
        
        this.mainContainerWrapper.style.display = 'flex'; 
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;

        document.body.style.overflow = 'hidden'; 
        document.body.classList.remove('menu-scrollable');
        this.mainMenuCard.style.marginTop = '';
        document.getElementById('mainContainerWrapper').style.marginTop = '';
    }
    
    setupMenuButtons(studioNames) {
        this.menuButtonsContainer.innerHTML = ''; 
        
        studioNames.forEach(name => {
            const newButton = document.createElement('button');
            newButton.className = 'neural-button';
            newButton.type = 'button';
            newButton.style.marginTop = '0';
            
            newButton.innerHTML = `
                <div class="button-bg"></div>
                <span class="button-text">${name}</span> <div class="button-glow"></div>
            `;

            newButton.addEventListener('click', () => {
                const url = `?studio=${encodeURIComponent(name)}`;
                window.open(window.location.origin + window.location.pathname + url, '_blank'); 
            });
            
            this.menuButtonsContainer.appendChild(newButton);
        });
    }


    // --- 🔴 MODIFIED: Announcement Logic (ดึงจาก this.announcementConfig) 🔴 ---

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

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        if (!isInitialLoad) {
            this.announcementModalOverlay.classList.remove('show', 'initial-show');
            this.announcementModalOverlay.style.display = 'none';
        }
        
        this.announcementImage.style.display = 'none';
        this.announcementActionArea.style.display = 'none'; 

        this.announcementModalOverlay.setAttribute('data-post-action', action);
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        // *** 🔴 NEW: ดึงค่าจาก Config ที่โหลดไว้ตั้งแต่ init() 🔴 ***
        const result = this.announcementConfig;
        
        const hasImage = result.imageUrl && result.imageUrl.trim() !== '';
        const hasButton = result.buttonText && result.buttonUrl; 
        
        // ถ้าไม่มี Content เลย
        if (!result.hasContent) {
            this.isAnnouncementActive = false; 
            this.closeAnnouncementModal();
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
        
        // Logic การแสดงผล (ใช้ค่าที่โหลดจาก Sheets API แล้ว)
        if (hasImage) {
            this.announcementImage.src = result.imageUrl.trim(); 
            
            // รอให้ Image Load/Error Event ทำงาน (มี Timeout ใน Event Listener แล้ว)
            
        } else {
            this.modalLoader.style.display = 'none'; 
            this.announcementModalOverlay.classList.remove('initial-show'); 
            // หากไม่มีภาพ ให้เรียก startCloseButtonControl ทันที
            this.startCloseButtonControl(action); 
        }
        
        if (hasButton) {
            this.announcementActionArea.style.display = 'block';
            this.announcementActionButton.style.display = 'flex';
            this.announcementActionButton.querySelector('.button-text').textContent = result.buttonText.trim();
            this.announcementActionButton.setAttribute('data-url', result.buttonUrl.trim());
            this.announcementActionButton.addEventListener('click', this._onAnnouncementButtonClick);
        }

        // *** ลบ Timeout 5 วินาทีที่ซ้ำซ้อนออก เพราะถูกจัดการใน event listener ของ this.announcementImage แล้ว ***
    }
    
    // --- (startCloseButtonControl, closeAnnouncementModal, Geofencing Logic เหมือนเดิม) ---
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
            this.closeIcon.style.display = 'none'; 
            this.countdownText.style.display = 'block'; 

            this.countdownInterval = setInterval(() => {
                this.countdownText.textContent = remaining; 
                remaining--;

                if (remaining < 0) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                    
                    this.countdownText.style.display = 'none'; 
                    this.closeIcon.style.display = 'block'; 
                }
            }, 1000);
            
        } else {
            this.closeAnnouncementButton.style.display = 'flex'; 
            this.closeIcon.style.display = 'block';
            this.countdownText.style.display = 'none';
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show', 'initial-show');
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
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
                 this.continueAppFlow();
            }
        }, 300); 
    }

    checkGeolocation() {
        if (this.target.lat === null) {
             this.updateStatus('error', 'การตั้งค่า Geofence ผิดพลาด', 'ไม่พบพิกัดเป้าหมาย (โปรดตรวจสอบ K1-K3)');
             this.retryButton.style.display = 'flex';
             return;
        }
        
        this.updateStatus('loading', `กำลังตรวจสอบตำแหน่ง ${this.studioName}...`, 'โปรดอนุญาตการเข้าถึง GPS เพื่อดำเนินการต่อ');
        this.retryButton.style.display = 'none'; 

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => this.geoSuccess(position),
                (error) => this.geoError(error), 
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } 
            );
        } else {
            this.updateStatus('error', 'เบราว์เซอร์ไม่รองรับ', 'โทรศัพท์ของคุณไม่รองรับ Geolocation หรือไม่ได้เปิด GPS');
        }
    }
    
    geoSuccess(position) {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const distance = this.calculateDistance(this.target.lat, this.target.lon, userLat, userLon);
        const distanceMeters = (distance * 1000).toFixed(0);

        if (distance <= this.target.dist) {
            this.updateStatus('success', 'ยืนยันตำแหน่งสำเร็จ!', `ระยะทาง: ${distanceMeters} เมตร (นำไปสู่แบบฟอร์ม...)`);
            setTimeout(() => {
                 window.open(this.target.url, '_self'); 
            }, 1000);

        } else {
            const maxMeters = this.target.dist * 1000;
            this.updateStatus('error', 'เข้าถึงถูกปฏิเสธ', `คุณอยู่ห่าง ${distanceMeters} เมตร (เกิน ${maxMeters} เมตร) โปรดลองใหม่อีกครั้งในพื้นที่ที่กำหนด`);
        }
    }
    
    geoError(error) {
        let errorMessage = 'ไม่สามารถเข้าถึงตำแหน่ง GPS ได้';
        let customMessage = 'โปรดตรวจสอบว่าได้เปิด GPS และอนุญาตการเข้าถึงตำแหน่งสำหรับเว็บไซต์นี้';

        if (error.code === 1) {
            errorMessage += ' (ถูกปฏิเสธ)';
        } else if (error.code === 2) {
            errorMessage += ' (ไม่พบตำแหน่ง)';
        } else if (error.code === 3) {
            errorMessage += ' (หมดเวลาค้นหา)';
        }
        
        this.updateStatus('error', errorMessage, customMessage);
        this.retryButton.style.display = 'flex'; 
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
            this.statusIconContainer.innerHTML = '<svg id="loadingIcon" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" style="background: none; shape-rendering: auto;" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" fill="none" stroke="currentColor" stroke-width="8" r="35" stroke-dasharray="164.93361431346415 56.97787143782138" style="transform: rotate(0deg); animation: rotate 1s linear infinite;"></circle></svg>';
            this.retryButton.style.display = 'none';
        } else if (type === 'error') {
            this.statusIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            this.retryButton.style.display = 'flex';
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
