class GeofenceApp {
    constructor() {
        this.mainMenuCard = document.getElementById('mainMenuCard');
        this.geofenceChecker = document.getElementById('geofenceChecker');
        this.menuButtonsContainer = document.getElementById('adminMenuButtons');
        
        this.statusTitle = document.getElementById('statusTitle');
        this.statusMessage = document.getElementById('statusMessage');
        this.statusIconContainer = document.getElementById('statusIcon');
        this.retryButton = document.getElementById('retryButton');
        this.pageTitle = document.getElementById('pageTitle');
        
        this.announcementModalOverlay = document.getElementById('announcementModalOverlay');
        this.announcementImage = document.getElementById('announcementImage');
        this.closeAnnouncementButton = document.getElementById('closeAnnouncementButton');
        this.modalLoader = document.getElementById('modalLoader'); 
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        this.WEB_APP_URL = 'https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?gid=0';

        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio') || sessionStorage.getItem('currentStudio') || null;
        if (this.params.get('studio')) sessionStorage.setItem('currentStudio', this.params.get('studio'));

        this.target = { lat: null, lon: null, dist: null, url: null };
        this.isBypassMode = false;
        this.bypassUrl = null; 

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        document.body.style.overflow = 'hidden'; 
        this.init();
    }

    init() {
        this.bindEvents();
        if (this.studioName) this.loadAnnouncement('studio_check', true);
        else this.showMainMenu();
    }

    bindEvents() {
        this.retryButton.addEventListener('click', () => this.checkGeolocation());
        this.closeAnnouncementButton.addEventListener('click', () => this.closeAnnouncementModal());
        this.announcementImage.addEventListener('load', () => {
            this.modalLoader.style.display = 'none';
            this.announcementImage.style.opacity = 1;
        });
        this.announcementImage.addEventListener('error', () => {
            this.modalLoader.style.display = 'none';
            this.announcementImage.style.opacity = 0;
        });
    }

    showMainMenu() {
        sessionStorage.removeItem('currentStudio');
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        document.body.style.overflow = 'auto';
        this.pageTitle.textContent = 'เมนู Studio';
        this.fetchStudioNamesAndSetupMenu();
    }

    showGeofenceChecker() {
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;
        document.body.style.overflow = 'hidden'; 
    }

    async fetchStudioNamesAndSetupMenu() {
        try {
            const formData = new FormData();
            formData.append('action', 'get_studio_list');
            const response = await fetch(this.WEB_APP_URL, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success && result.studioNames?.length > 0) this.setupMenuButtons(result.studioNames);
            else this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align:center;">ไม่สามารถโหลดรายการ Studio ได้</p>';
        } catch {
            this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align:center;">การเชื่อมต่อ API ล้มเหลว</p>';
        }
    }

    setupMenuButtons(studioNames) {
        this.menuButtonsContainer.innerHTML = ''; 
        studioNames.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'neural-button';
            btn.type = 'button';
            btn.innerHTML = `<div class="button-bg"></div><span class="button-text">${name}</span><div class="button-glow"></div>`;
            btn.addEventListener('click', () => window.open(`?studio=${encodeURIComponent(name)}`, '_self'));
            this.menuButtonsContainer.appendChild(btn);
        });
    }

    async loadAnnouncement(action, isInitialLoad = false) {
        this.announcementModalOverlay.style.display = 'flex';
        this.announcementModalOverlay.style.opacity = 0;
        this.modalLoader.style.display = 'flex';
        this.announcementImage.style.opacity = 0;
        this.announcementActionArea.style.display = 'none';
        this.closeAnnouncementButton.style.display = 'none';

        setTimeout(() => this.announcementModalOverlay.style.opacity = 1, 50); // fade-in

        try {
            const formData = new FormData();
            formData.append('action', 'get_geofence_config');
            formData.append('studio', this.studioName || '');
            const response = await fetch(this.WEB_APP_URL, { method: 'POST', body: formData });
            const result = await response.json();

            this.pendingAction = { type: 'geofence', data: result };

            if (result.hideClose) this.closeAnnouncementButton.style.display = 'none';
            else if (result.countdown && !isNaN(result.countdown)) this.startCountdown(result.countdown);
            else this.closeAnnouncementButton.style.display = 'flex';

            const formData2 = new FormData();
            formData2.append('action', 'get_announcement_image');
            formData2.append('sheetUrl', this.ANNOUNCEMENT_SHEET_URL);
            const res2 = await fetch(this.WEB_APP_URL, { method: 'POST', body: formData2 });
            const ann = await res2.json();

            if (ann.success && ann.imageUrl) this.announcementImage.src = ann.imageUrl.trim();
            if (ann.success && ann.buttonText && ann.buttonUrl) {
                this.announcementActionArea.style.display = 'block';
                this.announcementActionButton.querySelector('.button-text').textContent = ann.buttonText.trim();
                this.announcementActionButton.setAttribute('data-url', ann.buttonUrl.trim());
                this.announcementActionButton.addEventListener('click', this._onAnnouncementButtonClick);
            }
        } catch {
            this.closeAnnouncementModal();
        }
    }

    startCountdown(seconds) {
        const btn = this.closeAnnouncementButton;
        btn.style.opacity = 0;
        btn.style.display = 'flex';
        btn.disabled = true;

        let remaining = seconds;
        btn.textContent = remaining;
        const timer = setInterval(() => {
            remaining--;
            btn.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(timer);
                btn.textContent = '×';
                btn.disabled = false;
                // fade-in ปุ่มกากบาท
                let opacity = 0;
                const fadeIn = setInterval(() => {
                    opacity += 0.05;
                    btn.style.opacity = opacity;
                    if (opacity >= 1) clearInterval(fadeIn);
                }, 30);
            }
        }, 1000);
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.style.opacity = 0; // fade-out
        setTimeout(() => this.announcementModalOverlay.style.display = 'none', 300);
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        const pending = this.pendingAction;
        if (pending && pending.type === 'geofence') {
            const result = pending.data;
            if (!result.success) this.updateStatus('error', 'เกิดข้อผิดพลาด', result.message);
            else if (result.needsCheck === false) window.open(result.formUrl, '_self');
            else {
                this.target = { lat: result.targetLat, lon: result.targetLon, dist: result.maxDist, url: result.formUrl };
                this.showGeofenceChecker();
                this.checkGeolocation();
            }
        } else this.showMainMenu();
    }

    _onAnnouncementButtonClick = (event) => {
        const url = event.currentTarget.getAttribute('data-url');
        if (url) window.open(url, '_blank');
    }
}

document.addEventListener('DOMContentLoaded', () => new GeofenceApp());
