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
        this.globalLoader = document.getElementById('globalLoader'); // NEW: Global Loader

        // Announcement Modal Elements
        this.announcementModalOverlay = document.getElementById('announcementModalOverlay');
        this.announcementImage = document.getElementById('announcementImage');
        this.closeAnnouncementButton = document.getElementById('closeAnnouncementButton');
        this.modalLoader = document.getElementById('modalLoader'); 

        // Configuration 
        // ***** URL Apps Script ล่าสุดของคุณ *****
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzObYDke96Xn19aqriJAzeRYCAQeMPONNxpvMyvubBz435uHKa1LpTpC_C7bu835pQ/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q/edit?gid=0#gid=0';
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        this.pageTitle.textContent = 'ประกาศ'; 

        this.init();
    }

    init() {
        this.bindEvents();
        // เริ่มต้นด้วยการโหลดประกาศเสมอ
        this.loadAnnouncement(); 
        
        // *** NEW: ซ่อน Global Loader เมื่อแอปพร้อมรัน ***
        if (this.globalLoader) {
            this.globalLoader.style.opacity = '0';
            setTimeout(() => {
                this.globalLoader.style.display = 'none';
            }, 300);
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
             this.announcementImage.style.display = 'none'; 
             this.closeAnnouncementModal(); 
             console.error("Announcement Image failed to load or permission denied.");
        });
    }
    
    // --- App Flow Control ---

    continueAppFlow() {
        this.pageTitle.textContent = 'เมนูผู้ดูแล Studio';
        
         if (this.studioName) {
            this.showGeofenceChecker();
            this.fetchGeofenceConfig(); 
        } else {
            this.showMainMenu();
            this.setupMenuButtons();
        }
    }

    // --- UI/Mode Handlers ---

    showMainMenu() {
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        this.pageTitle.textContent = 'เมนูผู้ดูแล Studio';
        document.body.classList.add('light-mode'); 
    }

    showGeofenceChecker() {
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;
        document.body.classList.remove('light-mode'); 
    }

    setupMenuButtons() {
        const studioNames = ["Studio 1", "Studio 2", "Studio 3", "Studio 4", "Studio 5", "ประกาศ"];
        
        studioNames.forEach(name => {
            const newButton = document.createElement('button');
            newButton.className = 'neural-button';
            newButton.type = 'button';
            newButton.style.marginTop = '0';
            
            newButton.innerHTML = `
                <div class="button-bg"></div>
                <span class="button-text">เข้าสู่ ${name}</span>
                <div class="button-glow"></div>
            `;
            if (name === "ประกาศ") {
                newButton.querySelector('.button-text').textContent = name;
            }

            newButton.addEventListener('click', () => {
                window.location.href = `?studio=${encodeURIComponent(name)}`;
            });
            
            this.menuButtonsContainer.appendChild(newButton);
        });
    }

    // --- Announcement Logic ---

    async loadAnnouncement() {
        if (!this.announcementModalOverlay) {
            this.continueAppFlow();
            return;
        }
        
        this.announcementModalOverlay.classList.remove('show');

        try {
            const formData = new FormData();
            formData.append('action', 'get_announcement_image');
            formData.append('sheetUrl', this.ANNOUNCEMENT_SHEET_URL); 

            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData 
            });
            
            const result = await response.json();
            
            if (result.success && result.imageUrl && result.imageUrl.trim() !== '') {
                // โหลดรูปภาพสำเร็จ: แสดง Modal และ Loader
                this.announcementModalOverlay.style.display = 'flex'; 
                this.modalLoader.style.display = 'flex'; // แสดง Loader ทันที
                setTimeout(() => {
                    this.announcementModalOverlay.classList.add('show');
                }, 50);
                
                // ตั้งค่า src เพื่อให้เริ่มโหลด (เมื่อโหลดเสร็จ event listener จะจัดการต่อ)
                this.announcementImage.src = result.imageUrl.trim(); 
            } else {
                // โหลดไม่สำเร็จ/ไม่มีรูป: ไปที่ Flow หลักต่อ
                this.continueAppFlow();
            }
        } catch (error) {
            console.error('Error fetching announcement:', error);
            this.continueAppFlow();
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show');
        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';
            this.continueAppFlow(); 
        }, 300); 
    }

    // --- Geofencing Logic (โค้ดที่เหลือถูกละไว้) ---
    // (โค้ดส่วนนี้ยังคงเป็น Logic การตรวจสอบตำแหน่งตามที่ส่งให้ก่อนหน้า)
}

document.addEventListener('DOMContentLoaded', () => {
    new GeofenceApp();
});
