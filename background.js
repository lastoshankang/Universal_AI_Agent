// Universal AI Assistant - Background Script (통합 버전)
// Multi-Chat + MD Exporter 기능 통합

// ─────────────────────────────────────────────────────────────────────────────
// 전역 상태 및 설정
// ─────────────────────────────────────────────────────────────────────────────

// AI 사이트별 정보 (통합된 설정)
const AI_SITES = {
    chatgpt: {
        name: 'ChatGPT',
        url: 'https://chat.openai.com',
        patterns: [
            'https://chat.openai.com/*',
            'https://chatgpt.com/*',
            'https://chat.com/*'
        ],
        emoji: '🤖',
        color: '#10a37f'
    },
    claude: {
        name: 'Claude',
        url: 'https://claude.ai',
        patterns: ['https://claude.ai/*'],
        emoji: '🧠',
        color: '#d97706'
    },
    gemini: {
        name: 'Gemini',
        url: 'https://gemini.google.com',
        patterns: ['https://gemini.google.com/*'],
        emoji: '💎',
        color: '#4285f4'
    },
    perplexity: {
        name: 'Perplexity',
        url: 'https://www.perplexity.ai',
        patterns: [
            'https://www.perplexity.ai/*',
            'https://perplexity.ai/*'
        ],
        emoji: '🔍',
        color: '#6366f1'
    },
    grok: {
        name: 'Grok',
        url: 'https://grok.com',
        patterns: [
            'https://grok.com/*',
            'https://x.com/*',
            'https://twitter.com/*'
        ],
        emoji: '🚀',
        color: '#1da1f2'
    }
};

// 기본 설정
const DEFAULT_SETTINGS = {
    // 확장 프로그램 전체 제어
    extensionEnabled: true,
    
    // AI 서비스 활성화 설정
    enabledAIs: {
        chatgpt: true,
        claude: true,
        gemini: true,
        perplexity: true,
        grok: false
    },
    
    // Multi-Chat 기능 설정
    multiChat: {
        notifications: true,
        autoOpen: false,
        autoCollectResponses: true,
        sendDelay: 1000,
        debugMode: false,
        experimentalFeatures: false
    },
    
    // MD Exporter 기능 설정
    mdExporter: {
        includeUserMessages: true,
        includeAssistantMessages: true,
        includeTimestamp: true,
        autoSave: false,
        fileNameTemplate: '{service}_{title}_{timestamp}',
        notifications: true
    }
};

// 전역 확장 프로그램 상태
let extensionEnabled = true;
let currentAITabs = new Map(); // AI 탭 추적

// ─────────────────────────────────────────────────────────────────────────────
// 초기화 및 설치
// ─────────────────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Universal AI Assistant installed/updated:', details.reason);
    
    try {
        if (details.reason === 'install') {
            await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
            console.log('Default settings saved');
            
            // 첫 설치 시 환영 알림
            await showNotification(
                'Universal AI Assistant 설치 완료!',
                '이제 여러 AI에 동시 메시지 전송과 대화 내용 내보내기를 할 수 있습니다.'
            );
        }
        
        if (details.reason === 'update') {
            const version = chrome.runtime.getManifest().version;
            await showNotification(
                'Universal AI Assistant 업데이트됨',
                `버전 ${version}으로 업데이트되었습니다. Multi-Chat과 MD Exporter 기능이 통합되었습니다.`
            );
        }
        
        // 설정 로드 후 초기화
        await loadExtensionState();
        await updateExtensionBadge();
        await createContextMenus();
        
        // 정기 연결 확인 알람 설정
        await chrome.alarms.create('checkConnections', {
            delayInMinutes: 5,
            periodInMinutes: 5
        });
        
    } catch (error) {
        console.error('Installation setup failed:', error);
    }
});

chrome.runtime.onStartup.addListener(async () => {
    console.log('Universal AI Assistant started');
    await loadExtensionState();
    await updateExtensionBadge();
});

// ─────────────────────────────────────────────────────────────────────────────
// AI 서비스 감지 및 관리
// ─────────────────────────────────────────────────────────────────────────────

function detectAIService(url, title = '') {
    if (!url) return null;
    
    const hostname = url.toLowerCase();
    const pathname = new URL(url).pathname.toLowerCase();
    const titleLower = title.toLowerCase();
    
    // ChatGPT 감지
    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com') || hostname.includes('chat.com')) {
        return 'chatgpt';
    }
    // Claude 감지
    else if (hostname.includes('claude.ai')) {
        return 'claude';
    }
    // Gemini 감지
    else if (hostname.includes('gemini.google.com')) {
        return 'gemini';
    }
    // Perplexity 감지
    else if (hostname.includes('perplexity.ai')) {
        return 'perplexity';
    }
    // Grok 감지 (독립 사이트 + X.com 내부)
    else if (hostname.includes('grok.com')) {
        return 'grok';
    }
    else if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
        if (pathname.includes('grok') || 
            pathname.includes('/i/grok') ||
            titleLower.includes('grok')) {
            return 'grok';
        }
    }
    
    return null;
}

function getServiceInfo(service) {
    return AI_SITES[service] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 탭 관리 및 모니터링
// ─────────────────────────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!extensionEnabled) return;
    
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            const aiService = detectAIService(tab.url, tab.title);
            
            if (aiService) {
                const serviceInfo = getServiceInfo(aiService);
                
                // AI 탭 정보 저장
                currentAITabs.set(tabId, {
                    id: tabId,
                    service: aiService,
                    url: tab.url,
                    title: tab.title,
                    lastActive: Date.now()
                });
                
                // 아이콘 및 배지 설정
                await chrome.action.setTitle({
                    tabId: tabId,
                    title: `Universal AI Assistant - ${serviceInfo.name}`
                });
                
                const serviceAbbrev = {
                    chatgpt: 'GPT',
                    claude: 'CL',
                    grok: 'GK',
                    perplexity: 'PX',
                    gemini: 'GM'
                };
                
                await chrome.action.setBadgeText({
                    tabId: tabId,
                    text: serviceAbbrev[aiService]
                });
                
                await chrome.action.setBadgeBackgroundColor({
                    tabId: tabId,
                    color: serviceInfo.color
                });
                
                console.log(`AI service detected: ${serviceInfo.name} on tab ${tabId}`);
                
                // content script 준비 확인
                setTimeout(async () => {
                    try {
                        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                        if (response && response.success) {
                            console.log(`Content script ready on ${response.site || aiService}`);
                        }
                    } catch (error) {
                        console.log('Content script not ready yet for tab', tabId);
                    }
                }, 2000);
                
            } else {
                // AI 서비스가 아닌 경우 탭 정보 제거
                currentAITabs.delete(tabId);
                
                await chrome.action.setTitle({
                    tabId: tabId,
                    title: 'Universal AI Assistant - 지원되는 AI 서비스에서만 사용 가능'
                });
                
                await chrome.action.setBadgeText({
                    tabId: tabId,
                    text: ''
                });
            }
        } catch (error) {
            console.error('Tab update handler error:', error);
        }
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    currentAITabs.delete(tabId);
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    const tabInfo = currentAITabs.get(activeInfo.tabId);
    if (tabInfo) {
        tabInfo.lastActive = Date.now();
        console.log(`AI tab activated: ${tabInfo.service} - ${tabInfo.title}`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 확장 프로그램 상태 관리
// ─────────────────────────────────────────────────────────────────────────────

async function loadExtensionState() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        if (result.settings && typeof result.settings.extensionEnabled === 'boolean') {
            extensionEnabled = result.settings.extensionEnabled;
        }
        console.log('Extension state loaded:', extensionEnabled);
    } catch (error) {
        console.error('Extension state load failed:', error);
    }
}

async function updateExtensionBadge() {
    try {
        console.log('Updating extension badge, enabled:', extensionEnabled);
        
        // 전역 배지 설정 (탭별 설정은 tab update에서 처리)
        if (!extensionEnabled) {
            await chrome.action.setBadgeText({ text: "OFF" });
            await chrome.action.setBadgeBackgroundColor({ color: "#dc3545" });
        }
        
        await chrome.action.setTitle({
            title: `Universal AI Assistant ${extensionEnabled ? '(활성화됨)' : '(비활성화됨)'}`
        });
        
        console.log('Extension badge update completed');
        
    } catch (error) {
        console.error('Critical error in updateExtensionBadge:', error);
    }
}

async function toggleExtensionState() {
    extensionEnabled = !extensionEnabled;
    
    // 설정 저장
    try {
        const result = await chrome.storage.local.get(['settings']);
        const settings = { ...DEFAULT_SETTINGS, ...result.settings };
        settings.extensionEnabled = extensionEnabled;
        await chrome.storage.local.set({ settings: settings });
        console.log('Extension state saved:', extensionEnabled);
    } catch (error) {
        console.error('Failed to save extension state:', error);
    }
    
    // 배지 업데이트
    setTimeout(() => {
        updateExtensionBadge();
    }, 200);
    
    // 알림 표시
    await showNotification(
        'Universal AI Assistant',
        `확장 프로그램이 ${extensionEnabled ? '활성화' : '비활성화'}되었습니다.`
    );
    
    console.log('Extension toggled:', extensionEnabled);
    return extensionEnabled;
}

// ─────────────────────────────────────────────────────────────────────────────
// 컨텍스트 메뉴 관리
// ─────────────────────────────────────────────────────────────────────────────

async function createContextMenus() {
    try {
        await chrome.contextMenus.removeAll();
        
        // Multi-Chat 메뉴
        await chrome.contextMenus.create({
            id: 'sendToAllAI',
            title: '선택한 텍스트를 모든 AI에게 전송',
            contexts: ['selection']
        });
        
        // MD Exporter 메뉴  
        await chrome.contextMenus.create({
            id: 'exportToMarkdown',
            title: 'AI 대화를 마크다운으로 내보내기',
            contexts: ['page'],
            documentUrlPatterns: Object.values(AI_SITES).flatMap(site => site.patterns)
        });
        
        console.log('Context menus created');
    } catch (error) {
        console.error('Error creating context menus:', error);
    }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!extensionEnabled) {
        await showNotification('Universal AI Assistant', '확장 프로그램이 비활성화되어 있습니다.');
        return;
    }
    
    try {
        if (info.menuItemId === 'sendToAllAI' && info.selectionText) {
            await handleMultiChatContext(info.selectionText);
        } else if (info.menuItemId === 'exportToMarkdown') {
            await handleExportContext(tab);
        }
    } catch (error) {
        console.error('Context menu action failed:', error);
        await showNotification('Universal AI Assistant', '컨텍스트 메뉴 동작 중 오류가 발생했습니다.');
    }
});

async function handleMultiChatContext(text) {
    const settings = await getSettings();
    const enabledAIs = Object.keys(settings.enabledAIs).filter(ai => settings.enabledAIs[ai]);
    
    if (enabledAIs.length === 0) {
        await showNotification('Universal AI Assistant', '활성화된 AI가 없습니다. 설정을 확인해주세요.');
        return;
    }
    
    const result = await sendMessageToAllTabs(text, enabledAIs);
    if (result.success) {
        const successCount = result.results.filter(r => r.success).length;
        await showNotification('Universal AI Assistant', `${successCount}개의 AI에게 메시지를 전송했습니다.`);
    } else {
        await showNotification('Universal AI Assistant', '메시지 전송 중 오류가 발생했습니다.');
    }
}

async function handleExportContext(tab) {
    const aiService = detectAIService(tab.url, tab.title);
    if (!aiService) {
        await showNotification('Universal AI Assistant', '지원되지 않는 AI 서비스입니다.');
        return;
    }
    
    const serviceInfo = getServiceInfo(aiService);
    await showNotification(
        'Universal AI Assistant',
        `확장 프로그램 아이콘을 클릭해서 ${serviceInfo.name} 대화를 내보내세요.`
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메시지 처리 (통합된 API)
// ─────────────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleBackgroundMessage(request, sender, sendResponse);
    return true;
});

async function handleBackgroundMessage(request, sender, sendResponse) {
    try {
        console.log('Background received message:', request.action);
        
        // 확장 프로그램이 비활성화된 경우 일부 작업만 허용
        if (!extensionEnabled && !['getSettings', 'extensionToggled', 'updateBadge', 'getServiceInfo', 'ping'].includes(request.action)) {
            sendResponse({ success: false, error: '확장 프로그램이 비활성화되었습니다.', extensionDisabled: true });
            return;
        }
        
        switch (request.action) {
            // 확장 프로그램 제어
            case 'extensionToggled':
                extensionEnabled = request.enabled;
                setTimeout(() => updateExtensionBadge(), 200);
                sendResponse({ success: true });
                break;
                
            case 'updateBadge':
                setTimeout(() => updateExtensionBadge(), 200);
                sendResponse({ success: true });
                break;
                
            // 서비스 정보
            case 'getServiceInfo':
                const aiService = detectAIService(sender.tab?.url, sender.tab?.title);
                sendResponse({
                    service: aiService,
                    serviceInfo: aiService ? getServiceInfo(aiService) : null,
                    supported: !!aiService,
                    tabId: sender.tab?.id,
                    extensionEnabled: extensionEnabled
                });
                break;
                
            // Multi-Chat 기능
            case 'getAllTabs':
                const allTabs = await getAllAITabs();
                sendResponse({ success: true, tabs: allTabs });
                break;
                
            case 'openAllSites':
                const openResult = await openAllAISites();
                sendResponse(openResult);
                break;
                
            case 'sendToAllTabs':
                const sendResult = await sendMessageToAllTabs(request.message, request.enabledAIs);
                sendResponse(sendResult);
                break;
                
            // MD Exporter 기능
            case 'exportMarkdown':
                const exportResult = await handleMarkdownExport(request.tabId, request.options);
                sendResponse(exportResult);
                break;
                
            case 'batchExport':
                const batchResult = await handleBatchExport(request.tabIds, request.options);
                sendResponse(batchResult);
                break;
                
            // 설정 관리
            case 'getSettings':
                const settings = await getSettings();
                sendResponse({ success: true, settings, extensionEnabled });
                break;
                
            case 'saveSettings':
                await saveSettings(request.settings);
                if (typeof request.settings.extensionEnabled === 'boolean') {
                    extensionEnabled = request.settings.extensionEnabled;
                    setTimeout(() => updateExtensionBadge(), 200);
                }
                sendResponse({ success: true });
                break;
                
            // 알림
            case 'showNotification':
                await showNotification(request.title, request.message);
                sendResponse({ success: true });
                break;
                
            // 일반
            case 'ping':
                sendResponse({ pong: true, timestamp: Date.now(), extensionEnabled });
                break;
                
            default:
                console.warn('Unknown action:', request.action);
                sendResponse({ success: false, error: 'Unknown action: ' + request.action });
        }
    } catch (error) {
        console.error('Background message handler error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Chat 기능 구현
// ─────────────────────────────────────────────────────────────────────────────

async function getAllAITabs() {
    const allTabs = [];
    for (const [aiType, siteInfo] of Object.entries(AI_SITES)) {
        try {
            for (const pattern of siteInfo.patterns) {
                const tabs = await chrome.tabs.query({ url: pattern });
                allTabs.push(...tabs.map(tab => ({ ...tab, aiType })));
            }
        } catch (error) {
            console.error(`Error querying tabs for ${siteInfo.name}:`, error);
        }
    }
    return allTabs;
}

async function openAllAISites() {
    const results = [];
    try {
        const settings = await getSettings();
        
        for (const [aiType, siteInfo] of Object.entries(AI_SITES)) {
            if (!settings.enabledAIs[aiType]) {
                results.push({
                    site: siteInfo.name,
                    success: false,
                    error: '비활성화된 AI'
                });
                continue;
            }
            
            try {
                let existingTabs = [];
                for (const pattern of siteInfo.patterns) {
                    const tabs = await chrome.tabs.query({ url: pattern });
                    existingTabs.push(...tabs);
                }
                
                if (existingTabs.length > 0) {
                    await chrome.tabs.update(existingTabs[0].id, { active: true });
                    results.push({
                        site: siteInfo.name,
                        success: true,
                        tabId: existingTabs[0].id,
                        action: 'activated'
                    });
                } else {
                    const tab = await chrome.tabs.create({
                        url: siteInfo.url,
                        active: false
                    });
                    results.push({
                        site: siteInfo.name,
                        success: true,
                        tabId: tab.id,
                        action: 'created'
                    });
                }
            } catch (error) {
                results.push({
                    site: siteInfo.name,
                    success: false,
                    error: error.message
                });
            }
        }
        return { success: true, results };
    } catch (error) {
        console.error('Open all sites error:', error);
        return { success: false, error: error.message };
    }
}

async function sendMessageToAllTabs(message, enabledAIs) {
    const results = [];
    const settings = await getSettings();
    const sendDelay = settings.multiChat.sendDelay || 0;
    
    console.log('Sending message to AIs:', enabledAIs);
    
    for (let i = 0; i < enabledAIs.length; i++) {
        const aiType = enabledAIs[i];
        const siteInfo = AI_SITES[aiType];
        
        if (!siteInfo) {
            results.push({
                aiType,
                success: false,
                error: '지원하지 않는 AI 타입'
            });
            continue;
        }
        
        try {
            let tabs = [];
            for (const pattern of siteInfo.patterns) {
                const t = await chrome.tabs.query({ url: pattern });
                tabs.push(...t);
            }
            
            if (tabs.length === 0) {
                results.push({
                    aiType,
                    success: false,
                    error: '해당 사이트가 열려있지 않습니다'
                });
                continue;
            }
            
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'sendMessage',
                message: message,
                aiType: aiType
            });
            
            if (response && response.success) {
                results.push({
                    aiType,
                    success: true,
                    tabId: tabs[0].id,
                    site: response.site
                });
            } else {
                results.push({
                    aiType,
                    success: false,
                    error: response?.error || '알 수 없는 오류',
                    tabId: tabs[0].id
                });
            }
            
            if (sendDelay > 0 && i < enabledAIs.length - 1) {
                await new Promise(resolve => setTimeout(resolve, sendDelay));
            }
        } catch (error) {
            console.error(`Error sending to ${aiType}:`, error);
            results.push({
                aiType,
                success: false,
                error: error.message
            });
        }
    }
    return { success: true, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// MD Exporter 기능 구현
// ─────────────────────────────────────────────────────────────────────────────

async function handleMarkdownExport(tabId, options = {}) {
    try {
        // 탭 ID가 제공되지 않은 경우 현재 활성 탭 사용
        if (!tabId) {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = activeTab.id;
        }
        
        // AI 서비스 확인
        const tab = await chrome.tabs.get(tabId);
        const aiService = detectAIService(tab.url, tab.title);
        
        if (!aiService) {
            throw new Error('지원되지 않는 AI 서비스입니다.');
        }
        
        // 대화 데이터 가져오기
        const conversationResponse = await chrome.tabs.sendMessage(tabId, {
            action: 'getConversationData'
        });
        
        if (!conversationResponse || !conversationResponse.success) {
            throw new Error('대화 데이터를 가져올 수 없습니다.');
        }
        
        // 마크다운 생성
        const markdownResponse = await chrome.tabs.sendMessage(tabId, {
            action: 'exportToMarkdown',
            options: options
        });
        
        if (!markdownResponse || !markdownResponse.success) {
            throw new Error('마크다운 생성에 실패했습니다.');
        }
        
        // 파일명 생성
        const settings = await getSettings();
        const timestamp = new Date().toISOString()
            .slice(0, 19)
            .replace(/[:-]/g, '')
            .replace('T', '_');
            
        const serviceInfo = getServiceInfo(aiService);
        const title = conversationResponse.data?.title || 'conversation';
        
        const filename = generateFileName(
            settings.mdExporter.fileNameTemplate,
            {
                service: serviceInfo.name.toLowerCase(),
                title: sanitizeFileName(title),
                timestamp: timestamp
            }
        );
        
        // 파일 다운로드
        const blob = new Blob([markdownResponse.markdown], { 
            type: 'text/markdown;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        
        const downloadId = await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: !settings.mdExporter.autoSave
        });
        
        // URL 정리
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        // 성공 알림
        if (settings.mdExporter.notifications) {
            await showNotification(
                'Universal AI Assistant',
                `${serviceInfo.name} 대화가 마크다운으로 내보내졌습니다.`
            );
        }
        
        return {
            success: true,
            filename: filename,
            downloadId: downloadId,
            service: aiService,
            conversationData: conversationResponse.data
        };
        
    } catch (error) {
        console.error('Markdown export error:', error);
        await showNotification(
            'Universal AI Assistant 오류',
            `마크다운 내보내기 실패: ${error.message}`
        );
        return {
            success: false,
            error: error.message
        };
    }
}

async function handleBatchExport(tabIds, options = {}) {
    const results = [];
    
    try {
        for (const tabId of tabIds) {
            const result = await handleMarkdownExport(tabId, options);
            results.push({
                tabId: tabId,
                ...result
            });
            
            // 각 내보내기 사이에 잠시 대기 (브라우저 부하 방지)
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        await showNotification(
            'Universal AI Assistant',
            `일괄 내보내기 완료: 성공 ${successCount}개, 실패 ${failCount}개`
        );
        
        return {
            success: true,
            results: results,
            summary: { successCount, failCount }
        };
        
    } catch (error) {
        console.error('Batch export error:', error);
        return {
            success: false,
            error: error.message,
            results: results
        };
    }
}

function generateFileName(template, data) {
    let filename = template;
    
    for (const [key, value] of Object.entries(data)) {
        filename = filename.replace(`{${key}}`, value);
    }
    
    return filename + '.md';
}

function sanitizeFileName(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100); // 길이 제한
}

// ─────────────────────────────────────────────────────────────────────────────
// 키보드 단축키 처리
// ─────────────────────────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
    console.log('Command received:', command);
    
    try {
        switch (command) {
            case 'open-popup':
                await chrome.action.openPopup();
                break;
                
            case 'toggle-extension':
                const newState = await toggleExtensionState();
                console.log('Extension toggled via shortcut:', newState);
                break;
                
            case 'open-all-sites':
                if (!extensionEnabled) {
                    await showNotification('Universal AI Assistant', '확장 프로그램이 비활성화되어 있습니다.');
                    return;
                }
                const result = await openAllAISites();
                const successCount = result.results?.filter(r => r.success).length || 0;
                await showNotification('Universal AI Assistant', `${successCount}개의 AI 사이트를 열었습니다.`);
                break;
                
            case 'quick-send':
                if (!extensionEnabled) {
                    await showNotification('Universal AI Assistant', '확장 프로그램이 비활성화되어 있습니다.');
                    return;
                }
                await handleQuickSend();
                break;
                
            case 'export-markdown':
                if (!extensionEnabled) {
                    await showNotification('Universal AI Assistant', '확장 프로그램이 비활성화되어 있습니다.');
                    return;
                }
                await handleQuickExport();
                break;
                
            default:
                console.warn('Unknown command:', command);
        }
    } catch (error) {
        console.error('Command handler error:', error);
    }
});

async function handleQuickSend() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab) {
            await showNotification('Universal AI Assistant', '활성 탭을 찾을 수 없습니다.');
            return;
        }
        
        const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'getSelectedText' });
        if (response && response.text && response.text.trim()) {
            const settings = await getSettings();
            const enabledAIs = Object.keys(settings.enabledAIs).filter(ai => settings.enabledAIs[ai]);
            
            if (enabledAIs.length === 0) {
                await showNotification('Universal AI Assistant', '활성화된 AI가 없습니다.');
                return;
            }
            
            const result = await sendMessageToAllTabs(response.text, enabledAIs);
            if (result.success) {
                const successCount = result.results.filter(r => r.success).length;
                await showNotification('Universal AI Assistant', `빠른 전송 완료: ${successCount}개 AI`);
            }
        } else {
            await showNotification('Universal AI Assistant', '선택된 텍스트가 없습니다.');
        }
    } catch (error) {
        console.error('Quick send failed:', error);
        await showNotification('Universal AI Assistant', '빠른 전송 중 오류가 발생했습니다.');
    }
}

async function handleQuickExport() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab) {
            await showNotification('Universal AI Assistant', '활성 탭을 찾을 수 없습니다.');
            return;
        }
        
        const aiService = detectAIService(activeTab.url, activeTab.title);
        if (!aiService) {
            await showNotification('Universal AI Assistant', '현재 탭은 지원되는 AI 서비스가 아닙니다.');
            return;
        }
        
        const settings = await getSettings();
        const exportOptions = {
            includeUserMessages: settings.mdExporter.includeUserMessages,
            includeAssistantMessages: settings.mdExporter.includeAssistantMessages,
            includeTimestamp: settings.mdExporter.includeTimestamp
        };
        
        await handleMarkdownExport(activeTab.id, exportOptions);
        
    } catch (error) {
        console.error('Quick export failed:', error);
        await showNotification('Universal AI Assistant', '빠른 내보내기 중 오류가 발생했습니다.');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 설정 관리
// ─────────────────────────────────────────────────────────────────────────────

async function getSettings() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        return { ...DEFAULT_SETTINGS, ...result.settings };
    } catch (error) {
        console.error('Error getting settings:', error);
        return DEFAULT_SETTINGS;
    }
}

async function saveSettings(settings) {
    try {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
        await chrome.storage.local.set({ settings: mergedSettings });
        console.log('Settings saved:', mergedSettings);
    } catch (error) {
        console.error('Error saving settings:', error);
        throw error;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 알람 및 주기적 작업
// ─────────────────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!extensionEnabled) return;
    
    console.log('Alarm triggered:', alarm.name);
    switch (alarm.name) {
        case 'checkConnections':
            await checkAllConnections();
            break;
        default:
            console.warn('Unknown alarm:', alarm.name);
    }
});

async function checkAllConnections() {
    try {
        const tabs = await getAllAITabs();
        const results = [];
        
        for (const tab of tabs) {
            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    action: 'checkConnection'
                });
                results.push({
                    tabId: tab.id,
                    url: tab.url,
                    aiType: tab.aiType,
                    connected: response.connected
                });
            } catch (error) {
                results.push({
                    tabId: tab.id,
                    url: tab.url,
                    aiType: tab.aiType,
                    connected: false,
                    error: error.message
                });
            }
        }
        console.log('Connection check results:', results);
        return results;
    } catch (error) {
        console.error('Connection check failed:', error);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 네비게이션 감지 (SPA 대응)
// ─────────────────────────────────────────────────────────────────────────────

chrome.webNavigation.onCompleted.addListener((details) => {
    if (!extensionEnabled) return;
    
    if (details.frameId === 0) { // 메인 프레임만
        const aiService = detectAIService(details.url);
        
        if (aiService) {
            console.log(`${aiService} navigation completed:`, details.url);
            
            // 네비게이션 완료 후 content script에 알림
            setTimeout(() => {
                chrome.tabs.sendMessage(details.tabId, { action: 'navigation-completed' })
                    .then(response => {
                        console.log(`${aiService} navigation notification sent:`, response);
                    })
                    .catch(error => {
                        console.log(`${aiService} navigation notification failed:`, error.message);
                    });
            }, 1500);
        }
    }
}, {
    url: Object.values(AI_SITES).flatMap(site => 
        site.patterns.map(pattern => ({ urlContains: new URL(pattern.replace('/*', '')).hostname }))
    )
});

// ─────────────────────────────────────────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────────────────────────────────────────

async function showNotification(title, message) {
    try {
        const settings = await getSettings();
        if (settings.multiChat.notifications || settings.mdExporter.notifications) {
            await chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: title,
                message: message
            });
        }
    } catch (error) {
        console.error('Error showing notification:', error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 스토리지 변경 감지
// ─────────────────────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (namespace === 'local' && changes.settings) {
        console.log('Settings changed:', changes.settings.newValue);
        
        const newSettings = changes.settings.newValue;
        if (newSettings && typeof newSettings.extensionEnabled === 'boolean') {
            const oldEnabled = extensionEnabled;
            extensionEnabled = newSettings.extensionEnabled;
            
            if (oldEnabled !== extensionEnabled) {
                updateExtensionBadge();
                console.log('Extension state updated from storage change:', extensionEnabled);
            }
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 오류 처리 및 로깅
// ─────────────────────────────────────────────────────────────────────────────

// 확장 프로그램 생명주기 이벤트
chrome.runtime.onSuspend.addListener(() => {
    console.log('Universal AI Assistant suspended');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Universal AI Assistant started');
});

// 언인스톨 URL 설정
chrome.runtime.setUninstallURL('https://forms.gle/feedback-form').catch(() => {
    console.log('Could not set uninstall URL');
});

// 전역 오류 처리
self.addEventListener('error', (event) => {
    console.error('Background script error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Background script unhandled rejection:', event.reason);
});

// ─────────────────────────────────────────────────────────────────────────────
// 디버그 및 개발 도구
// ─────────────────────────────────────────────────────────────────────────────

// 전역 디버그 함수
globalThis.debugUniversalAI = function() {
    console.log('=== Universal AI Assistant Background Debug ===');
    console.log('Extension enabled:', extensionEnabled);
    console.log('Current AI tabs:', Array.from(currentAITabs.values()));
    console.log('AI sites config:', AI_SITES);
    console.log('Runtime ID:', chrome.runtime.id);
    console.log('Manifest:', chrome.runtime.getManifest());
    
    // 설정 정보 출력
    getSettings().then(settings => {
        console.log('Current settings:', settings);
    });
};

globalThis.getExtensionStats = function() {
    return {
        version: chrome.runtime.getManifest().version,
        enabled: extensionEnabled,
        aiTabsCount: currentAITabs.size,
        supportedServices: Object.keys(AI_SITES),
        apis: {
            contextMenus: !!chrome.contextMenus,
            notifications: !!chrome.notifications,
            webNavigation: !!chrome.webNavigation,
            downloads: !!chrome.downloads,
            storage: !!chrome.storage,
            tabs: !!chrome.tabs
        }
    };
};

console.log('🚀 Universal AI Assistant background script loaded successfully (v2.0.0)');
console.log('Features: Multi-Chat + MD Exporter integrated');