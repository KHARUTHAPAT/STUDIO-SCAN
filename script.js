// Geofencing and Announcement Logic
class GeofenceApp {
    constructor() {
        // UI Elements
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
        this.modalLoader = document.getElementById('modalLoader'); 
        
        // NEW: Announcement Button Elements
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        // Configuration 
        // URL Apps Script ล่าสุดของคุณ (อัปเดตแล้ว)
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyBz6JISCmdhxPlcUp3MVRT-TvZlYFZzbkk6eg5iQss5tASfjYy13JRODKZYPgEb7LS/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q/edit?gid=0#gid=0';
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        // NEW: State for Bypass Mode
        this.isBypassMode = false;
        this.bypassUrl = null; 

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        this.pageTitle.textContent = 'ประกาศ'; 

        this.init();
    }

    init() {
        this.bindEvents();
        
        // *** แก้ไข: เริ่มต้นด้วยการโหลดประกาศเสมอ (ตามคำขอให้ Loader ขึ้นตั้งแต่เข้าเว็บ) ***
        this.loadAnnouncement('initial_check');
    }
    
    // NEW: Function to handle button click (open URL in new tab)
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
        
        // เมื่อรูปโหลดเสร็จ ให้ซ่อน Loader และแสดงรูปภาพ
        this.announcementImage.addEventListener('load', () => {
             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'block';
        });

        // หากโหลดรูปไม่สำเร็จ (เกิด Error) ให้ดำเนินการต่อตาม Flow หลัก
        this.announcementImage.addEventListener('error', () => {
             this.modalLoader.style.display = 'none';
             // If there is no button, close the modal immediately.
             if (this.announcementActionArea.style.display === 'none') {
                 this.closeAnnouncementModal(); 
             }
             this.announcementImage.style.display = 'none'; 
             console.error("Announcement Image failed to load or permission denied.");
        });
    }
    
    // --- App Flow Control ---

    continueAppFlow() {
        // ฟังก์ชันนี้ถูกเรียกหลังจากปิด Modal Announcement แล้ว
        this.isBypassMode = false;
        this.bypassUrl = null;
        
        // *** แก้ไข: เปลี่ยนการแสดงผลตามเงื่อนไข Studio Name ***
        if (this.studioName) {
            // Studio selected: Fetch config to determine if Geofence or Bypass
            this.fetchGeofenceConfig(); 
            
        } else {
            // No studio selected: Show main menu
            this.showMainMenu();
        }
    }
    
    // --- UI/Mode Handlers ---

    showMainMenu() {
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        // *** แก้ไข: เปลี่ยนข้อความ title เป็น 'ประกาศ' เมื่ออยู่หน้าเมนูหลัก ***
        this.pageTitle.textContent = 'ประกาศ';
        document.body.classList.add('light-mode'); 
        document.body.classList.remove('dark-mode'); 
        
        // Fetch menu only when showing the menu
        this.fetchStudioNamesAndSetupMenu();
    }

    showGeofenceChecker() {
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;
        document.body.classList.remove('light-mode'); 
        document.body.classList.add('dark-mode'); 
    }
    
    // ดึงชื่อ Studio และสร้างปุ่ม
    async fetchStudioNamesAndSetupMenu() {
        try {
            const formData = new FormData();
            formData.append('action', 'get_studio_list');

            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData 
            });
            
            const result = await response.json();
            
            if (result.success && result.studioNames && result.studioNames.length > 0) {
                this.setupMenuButtons(result.studioNames);
            } else {
                this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align: center;">ไม่สามารถโหลดรายการ Studio ได้ (โปรดตรวจสอบชีต \'Studio\' และสิทธิ์การเข้าถึง)</p>';
                console.error("No studio names returned or failed to fetch.");
            }

        } catch (error) {
            this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align: center;">การเชื่อมต่อ API ล้มเหลว</p>';
            console.error("Failed to fetch studio list:", error);
        }
    }

    setupMenuButtons(studioNames) {
        this.menuButtonsContainer.innerHTML = ''; // ล้างปุ่มที่มีอยู่ทั้งหมดก่อนสร้างชุดใหม่
        
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
                window.location.href = `?studio=${encodeURIComponent(name)}`;
            });
            
            this.menuButtonsContainer.appendChild(newButton);
        });
    }

    // --- Announcement Logic (พร้อม Timeout) ---

    // action: 'initial_check', 'geofence_check', 'bypass_redirect'
    async loadAnnouncement(action) {
        if (!this.announcementModalOverlay) {
             // Handle case where modal is not available
             if (action === 'initial_check') { this.continueAppFlow(); }
             else if (action === 'geofence_check') { this.showGeofenceChecker(); this.checkGeolocation(); }
             else if (action === 'bypass_redirect' && this.bypassUrl) { window.top.location.href = this.bypassUrl; }
             return;
        }
        
        this.announcementModalOverlay.classList.remove('show');
        this.announcementImage.style.display = 'none';
        this.announcementActionArea.style.display = 'none'; // Hide button area

        // Set the post action for closeAnnouncementModal
        this.announcementModalOverlay.setAttribute('data-post-action', action);
        
        // Remove previous event listener from button (if any)
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        // *** แก้ไข: แสดง Modal และ Loader ทันทีที่ฟังก์ชันเริ่ม (ตามคำขอ) ***
        this.announcementModalOverlay.style.display = 'flex'; 
        this.modalLoader.style.display = 'flex'; // แสดง Loader ทันที
        setTimeout(() => {
            this.announcementModalOverlay.classList.add('show');
        }, 50);


        try {
            const formData = new FormData();
            formData.append('action', 'get_announcement_image');
            formData.append('sheetUrl', this.ANNOUNCEMENT_SHEET_URL); 

            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData 
            });
            
            const result = await response.json();
            
            // ใช้เงื่อนไขที่ Apps Script ส่งกลับมา
            const hasImage = result.success && result.imageUrl && result.imageUrl.trim() !== '';
            const hasButton = result.success && result.buttonText && result.buttonUrl; 

            if (hasImage || hasButton) {
                
                // Setup Image
                if (hasImage) {
                    // Loader ยังคงทำงานอยู่
                    this.announcementImage.src = result.imageUrl.trim(); // ตั้งค่า src เพื่อให้เริ่มโหลด
                } else {
                    // ไม่มีรูปภาพ, ซ่อน Loader ทันที
                    this.modalLoader.style.display = 'none'; 
                }
                
                // Setup Button
                if (hasButton) {
                    this.announcementActionArea.style.display = 'block';
                    this.announcementActionButton.style.display = 'flex';
                    this.announcementActionButton.querySelector('.button-text').textContent = result.buttonText.trim();
                    this.announcementActionButton.setAttribute('data-url', result.buttonUrl.trim());
                    
                    // Attach click listener for the button
                    this.announcementActionButton.addEventListener('click', this._onAnnouncementButtonClick);
                }

                // **** Timeout 5 วินาที (ป้องกันการค้าง) ****
                const loadTimeout = setTimeout(() => {
                    const isImageLoading = hasImage && (this.modalLoader.style.display !== 'none' || this.announcementImage.style.display === 'none');
                    if (isImageLoading && !hasButton) {
                        console.warn("Announcement load timeout. Skipping image and continuing flow.");
                        this.announcementImage.src = ''; // ยกเลิกการโหลด
                        this.modalLoader.style.display = 'none';
                        this.closeAnnouncementModal(); 
                    } else if (isImageLoading && hasButton) {
                        this.announcementImage.src = '';
                        this.modalLoader.style.display = 'none';
                    }
                }, 5000); 
                
                // เคลียร์ timeout เมื่อรูปโหลดสำเร็จ
                this.announcementImage.onload = () => {
                    clearTimeout(loadTimeout);
                    this.modalLoader.style.display = 'none';
                    this.announcementImage.style.display = 'block';
                };

                // เคลียร์ timeout เมื่อโหลดรูปไม่สำเร็จ
                this.announcementImage.onerror = () => {
                    clearTimeout(loadTimeout);
                    this.modalLoader.style.display = 'none';
                    if (!hasButton) { 
                        this.closeAnnouncementModal();
                    }
                };

            } else {
                // ไม่มีรูปและไม่มีปุ่ม: ปิด Modal และไปที่ Flow หลักต่อ
                this.closeAnnouncementModal();
            }
        } catch (error) {
            console.error('Error fetching announcement:', error);
            this.closeAnnouncementModal();
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show');
        
        // Clean up button listener
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
        
        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';
            
            if (postAction === 'bypass_redirect' && this.bypassUrl) {
                // Bypass mode, redirect immediately
                window.top.location.href = this.bypassUrl;
            } else if (postAction === 'geofence_check') {
                // Geofence check needed, proceed to checker
                this.showGeofenceChecker();
                this.checkGeolocation();
            } else { // postAction === 'initial_check' or unknown/default
                // ถ้ามาจากการเช็คครั้งแรก ให้ไปที่ continueAppFlow เพื่อเริ่มกระบวนการหลัก
                this.continueAppFlow();
            }
        }, 300); 
    }

    // --- Geofencing Logic ---

    async fetchGeofenceConfig() {
        // แสดงสถานะ Loading ของ Geofence Checker ก่อน
        this.updateStatus('loading', `กำลังโหลดข้อมูล ${this.studioName}...`, 'กำลังติดต่อเซิร์ฟเวอร์เพื่อดึงพิกัดที่ถูกต้อง');
        
        const formData = new FormData();
        formData.append('action', 'get_geofence_config');
        formData.append('studio', this.studioName);

        try {
            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                if (result.needsCheck === false) {
                    // *** โหมด Bypass: ซ่อน Geofence Checker ทันที และเตรียม Redirect ***
                    this.geofenceChecker.style.display = 'none'; 
                    this.isBypassMode = true; 
                    this.bypassUrl = result.formUrl;
                    
                    // แสดงประกาศ (หากมี) และเมื่อปิดจะ Redirect
                    // NOTE: โหมด Bypass จะต้องรอให้ Modal Announcement ทำงานเสร็จเสมอ
                    this.loadAnnouncement('bypass_redirect'); 
                     return;
                }
                
                // Geofence Check Required
                this.target.lat = result.targetLat;
                this.target.lon = result.targetLon;
                this.target.dist = result.maxDist;
                this.target.url = result.formUrl;
                
                // ต้องการ Geofence Check: แสดงประกาศก่อน และเมื่อปิดประกาศจะเริ่ม Geofence Check
                this.loadAnnouncement('geofence_check'); 
                
            } else {
                this.updateStatus('error', 'เกิดข้อผิดพลาด', result.message || 'ไม่สามารถดึงข้อมูลพิกัดจากเซิร์ฟเวอร์');
            }
        } catch (error) {
            this.updateStatus('error', 'การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อกับ Web App ได้');
        }
    }

    checkGeolocation() {
        if (this.target.lat === null) {
             this.fetchGeofenceConfig();
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
                 window.top.location.href = this.target.url;
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
        
        // แสดงข้อความและปุ่ม Retry
        this.updateStatus('error', errorMessage, customMessage);
        this.retryButton.style.display = 'flex'; // แสดงปุ่ม "ลองใหม่อีกครั้ง"
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
}

document.addEventListener('DOMContentLoaded', () => {
    new GeofenceApp();
});
