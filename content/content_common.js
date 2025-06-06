// ─────────────────────────────────────────────────────────────────────────────
// Universal AI Assistant - Common Content Script
// Multi-Chat + MD Export 통합 기능 제공
// ─────────────────────────────────────────────────────────────────────────────

// 전역 네임스페이스 초기화
if (typeof window.UniversalAIAssistant === 'undefined') {
    window.UniversalAIAssistant = {
        // 확장 프로그램 상태
        extensionEnabled: true,
        currentService: null,
        serviceModule: null,
        initialized: false,
        lastUrl: location.href,
        
        // 메시지 전송 관련
        isSending: false,
        sendingQueue: [],
        
        // MD 내보내기 관련
        exportInProgress: false,
        lastExportTime: null,
        
        // 공통 설정
        settings: {
            extensionEnabled: true,
            enabledAIs: {
                chatgpt: true,
                claude: true,
                gemini: true,
                perplexity: true,
                grok: false
            },
            notifications: true,
            sendDelay: 1000,
            debugMode: false,
            exportOptions: {
                includeUserMessages: true,
                includeAssistantMessages: true,
                includeTimestamp: true
            }
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// 서비스 감지 및 식별
// ─────────────────────────────────────────────────────────────────────────────

function detectAIService() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    const fullUrl = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();

    debugLog('detection', 'Detecting service', { hostname, pathname, fullUrl, title });

    // ChatGPT 감지
    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com') || hostname.includes('chat.com')) {
        return 'chatgpt';
    }
    // Claude 감지
    else if (hostname.includes('claude.ai')) {
        return 'claude';
    }
    // Grok 감지 (독립 사이트 + X.com 내부)
    else if (hostname.includes('grok.com')) {
        return 'grok';
    }
    else if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
        if (pathname.includes('grok') || 
            pathname.includes('/i/grok') ||
            fullUrl.includes('grok') ||
            title.includes('grok') ||
            document.querySelector('[data-testid*="grok"], .grok, [class*="grok"]')) {
            return 'grok';
        }
    }
    // Perplexity 감지
    else if (hostname.includes('perplexity.ai')) {
        return 'perplexity';
    }
    // Gemini 감지
    else if (hostname.includes('gemini.google.com')) {
        return 'gemini';
    }

    return null;
}

function getServiceDisplayInfo(service) {
    const serviceInfo = {
        chatgpt: { name: 'ChatGPT', emoji: '🤖', color: '#10a37f' },
        claude: { name: 'Claude', emoji: '🧠', color: '#d97706' },
        grok: { name: 'Grok', emoji: '🚀', color: '#1da1f2' },
        perplexity: { name: 'Perplexity', emoji: '🔍', color: '#6366f1' },
        gemini: { name: 'Gemini', emoji: '💎', color: '#4285f4' }
    };
    return serviceInfo[service] || { name: 'AI', emoji: '🤖', color: '#6c757d' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 설정 관리
// ─────────────────────────────────────────────────────────────────────────────

async function loadExtensionSettings() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        if (result.settings) {
            window.UniversalAIAssistant.settings = {
                ...window.UniversalAIAssistant.settings,
                ...result.settings
            };
            
            // 확장 프로그램 활성화 상태 업데이트
            if (typeof result.settings.extensionEnabled === 'boolean') {
                window.UniversalAIAssistant.extensionEnabled = result.settings.extensionEnabled;
            }
        }
        debugLog('settings', 'Settings loaded', window.UniversalAIAssistant.settings);
    } catch (error) {
        debugLog('settings', 'Failed to load settings:', error);
    }
}

async function saveExtensionSettings() {
    try {
        await chrome.storage.local.set({ 
            settings: window.UniversalAIAssistant.settings 
        });
        debugLog('settings', 'Settings saved');
    } catch (error) {
        debugLog('settings', 'Failed to save settings:', error);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chrome Extension 메시지 리스너 (통합)
// ─────────────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog('message', 'Received message', request);
    
    // 확장 프로그램이 비활성화된 경우 제한된 기능만 허용
    const allowedActionsWhenDisabled = [
        'ping', 'checkConnection', 'getSelectedText', 'getServiceInfo', 
        'getConversationData', 'exportToMarkdown'
    ];
    
    if (!window.UniversalAIAssistant.extensionEnabled && 
        !allowedActionsWhenDisabled.includes(request.action)) {
        sendResponse({ 
            success: false, 
            error: '확장 프로그램이 비활성화되어 있습니다.',
            extensionDisabled: true 
        });
        return true;
    }
    
    // 메시지 액션 처리
    switch (request.action) {
        // ─── 공통 액션 ───
        case 'ping':
            handlePing(request, sendResponse);
            break;
        case 'checkConnection':
            handleCheckConnection(request, sendResponse);
            break;
        case 'getSelectedText':
            handleGetSelectedText(request, sendResponse);
            break;
        case 'getServiceInfo':
            handleGetServiceInfo(request, sendResponse);
            break;
        case 'navigation-completed':
            handleNavigationCompleted(request, sendResponse);
            break;
            
        // ─── 메시지 전송 액션 ───
        case 'testConnection':
            handleTestConnection(request, sendResponse);
            break;
        case 'sendMessage':
            handleSendMessage(request, sendResponse);
            break;
        case 'getResponse':
            handleGetResponse(request, sendResponse);
            break;
            
        // ─── MD 내보내기 액션 ───
        case 'getConversationData':
            handleGetConversationData(request, sendResponse);
            break;
        case 'exportToMarkdown':
            handleExportToMarkdown(request, sendResponse);
            break;
            
        default:
            sendResponse({ 
                success: false, 
                error: 'Unknown action: ' + request.action 
            });
    }
    
    return true; // 비동기 응답을 위해 true 반환
});

// ─────────────────────────────────────────────────────────────────────────────
// 메시지 핸들러 함수들
// ─────────────────────────────────────────────────────────────────────────────

function handlePing(request, sendResponse) {
    const service = detectAIService();
    sendResponse({ 
        pong: true, 
        service: service,
        timestamp: Date.now(),
        extensionEnabled: window.UniversalAIAssistant.extensionEnabled,
        initialized: window.UniversalAIAssistant.initialized
    });
}

async function handleCheckConnection(request, sendResponse) {
    try {
        const service = detectAIService();
        if (!service) {
            sendResponse({ 
                connected: false, 
                error: '지원되지 않는 AI 서비스입니다' 
            });
            return;
        }
        
        const serviceModule = window.UniversalAIAssistant.serviceModule;
        if (!serviceModule || typeof serviceModule.checkConnection !== 'function') {
            sendResponse({ 
                connected: false, 
                error: '서비스 모듈이 로드되지 않았습니다' 
            });
            return;
        }
        
        const isConnected = await serviceModule.checkConnection();
        sendResponse({ 
            connected: isConnected && window.UniversalAIAssistant.extensionEnabled,
            service: service,
            extensionEnabled: window.UniversalAIAssistant.extensionEnabled
        });
    } catch (error) {
        debugLog('connection', 'Check connection error:', error);
        sendResponse({ 
            connected: false, 
            error: error.message 
        });
    }
}

function handleGetSelectedText(request, sendResponse) {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({ 
        text: selectedText,
        success: true 
    });
}

function handleGetServiceInfo(request, sendResponse) {
    const service = detectAIService();
    const serviceInfo = getServiceDisplayInfo(service);
    
    sendResponse({
        service: service,
        serviceInfo: serviceInfo,
        supported: !!service,
        extensionEnabled: window.UniversalAIAssistant.extensionEnabled,
        initialized: window.UniversalAIAssistant.initialized
    });
}

function handleNavigationCompleted(request, sendResponse) {
    debugLog('navigation', 'Navigation completed, reinitializing...');
    setTimeout(() => {
        initializeService();
    }, 1000);
    sendResponse({ received: true });
}

async function handleTestConnection(request, sendResponse) {
    try {
        const serviceModule = window.UniversalAIAssistant.serviceModule;
        if (!serviceModule || typeof serviceModule.testConnection !== 'function') {
            throw new Error('서비스 모듈이 로드되지 않았습니다');
        }
        
        const result = await serviceModule.testConnection();
        sendResponse(result);
    } catch (error) {
        debugLog('test', 'Test connection error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

async function handleSendMessage(request, sendResponse) {
    try {
        if (window.UniversalAIAssistant.isSending) {
            sendResponse({ 
                success: false, 
                error: '이미 메시지 전송 중입니다.' 
            });
            return;
        }
        
        const serviceModule = window.UniversalAIAssistant.serviceModule;
        if (!serviceModule || typeof serviceModule.sendMessage !== 'function') {
            throw new Error('서비스 모듈이 로드되지 않았습니다');
        }
        
        window.UniversalAIAssistant.isSending = true;
        const result = await serviceModule.sendMessage(request.message);
        sendResponse(result);
    } catch (error) {
        debugLog('send', 'Send message error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    } finally {
        window.UniversalAIAssistant.isSending = false;
    }
}

async function handleGetResponse(request, sendResponse) {
    try {
        const serviceModule = window.UniversalAIAssistant.serviceModule;
        if (!serviceModule || typeof serviceModule.getLatestResponse !== 'function') {
            throw new Error('서비스 모듈이 로드되지 않았습니다');
        }
        
        const result = await serviceModule.getLatestResponse();
        sendResponse(result);
    } catch (error) {
        debugLog('response', 'Get response error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

async function handleGetConversationData(request, sendResponse) {
    try {
        const service = detectAIService();
        if (!service) {
            throw new Error('지원되지 않는 AI 서비스입니다');
        }
        
        const serviceModule = window.UniversalAIAssistant.serviceModule;
        if (!serviceModule || typeof serviceModule.getConversationData !== 'function') {
            throw new Error('서비스 모듈이 로드되지 않았습니다');
        }
        
        const data = await serviceModule.getConversationData();
        sendResponse({ 
            success: true, 
            data: data, 
            service: service 
        });
    } catch (error) {
        debugLog('conversation', 'Get conversation data error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

async function handleExportToMarkdown(request, sendResponse) {
    try {
        if (window.UniversalAIAssistant.exportInProgress) {
            throw new Error('이미 내보내기가 진행 중입니다');
        }
        
        const service = detectAIService();
        if (!service) {
            throw new Error('지원되지 않는 AI 서비스입니다');
        }
        
        const serviceModule = window.UniversalAIAssistant.serviceModule;
        if (!serviceModule || typeof serviceModule.generateMarkdown !== 'function') {
            throw new Error('서비스 모듈이 로드되지 않았습니다');
        }
        
        window.UniversalAIAssistant.exportInProgress = true;
        
        const options = request.options || window.UniversalAIAssistant.settings.exportOptions;
        const markdown = generateFullMarkdown(service, options);
        
        window.UniversalAIAssistant.lastExportTime = Date.now();
        
        sendResponse({ 
            success: true, 
            markdown: markdown 
        });
    } catch (error) {
        debugLog('export', 'Export to markdown error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    } finally {
        window.UniversalAIAssistant.exportInProgress = false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 조작 및 텍스트 추출 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

function findElement(selectors, timeout = 5000) {
    if (!selectors || !Array.isArray(selectors)) return null;
    
    for (const selector of selectors) {
        try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (element && isElementVisible(element)) {
                    debugLog('dom', `Found element with selector: ${selector}`);
                    return element;
                }
            }
        } catch (error) {
            debugLog('dom', `Selector error: ${selector}`, error);
        }
    }
    return null;
}

function findElements(selectors) {
    if (!selectors || !Array.isArray(selectors)) return [];
    
    for (const selector of selectors) {
        try {
            const elements = Array.from(document.querySelectorAll(selector))
                .filter(el => isElementVisible(el));
            if (elements.length > 0) {
                debugLog('dom', `Found ${elements.length} elements with selector: ${selector}`);
                return elements;
            }
        } catch (error) {
            debugLog('dom', `Selector error: ${selector}`, error);
        }
    }
    return [];
}

function isElementVisible(element) {
    if (!element || !element.offsetParent) return false;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        parseFloat(style.opacity) > 0
    );
}

function extractTextFromElement(element) {
    if (!element) return '';

    // 요소 복사하여 안전하게 처리
    const elementCopy = element.cloneNode(true);

    // 불필요한 요소 제거
    elementCopy.querySelectorAll(
        '.citation, .absolute, .pointer-events-none, ' +
        '[class*="animate-"], [class*="transition-"], ' +
        'button:not(.code-block button), [role="button"], .cursor-pointer, ' +
        '.opacity-0, [style*="opacity: 0"], ' +
        '.copy-button, .edit-button, .expand-button'
    ).forEach(el => el.remove());

    // 테이블 처리
    elementCopy.querySelectorAll('table').forEach(table => {
        const tableMarkdown = extractTableMarkdown(table);
        if (tableMarkdown) {
            const replacement = document.createElement('div');
            replacement.textContent = `\n${tableMarkdown}\n`;
            table.replaceWith(replacement);
        }
    });

    // 코드 블록 처리
    elementCopy.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        if (code) {
            const language = code.className.match(/language-(\w+)/)?.[1] || 'plaintext';
            const codeText = code.textContent;
            const fenced = document.createElement('div');
            fenced.textContent = `\n\`\`\`${language}\n${codeText}\n\`\`\`\n`;
            pre.replaceWith(fenced);
        }
    });

    // 인라인 코드 처리
    elementCopy.querySelectorAll('code:not(pre code)').forEach(inline => {
        const txt = inline.textContent;
        const replacement = document.createElement('span');
        replacement.textContent = `\`${txt}\``;
        inline.replaceWith(replacement);
    });

    // 볼드/이탤릭 처리
    elementCopy.querySelectorAll('strong, b, .font-bold').forEach(bold => {
        const txt = bold.textContent;
        const replacement = document.createElement('span');
        replacement.textContent = `**${txt}**`;
        bold.replaceWith(replacement);
    });

    elementCopy.querySelectorAll('em, i, .italic').forEach(italic => {
        const txt = italic.textContent;
        const replacement = document.createElement('span');
        replacement.textContent = `*${txt}*`;
        italic.replaceWith(replacement);
    });

    // 링크 처리
    elementCopy.querySelectorAll('a:not(.citation)').forEach(link => {
        const href = link.getAttribute('href');
        const text = link.textContent;
        const replacement = document.createElement('span');
        if (href && !href.startsWith('#') && text.trim()) {
            replacement.textContent = `[${text}](${href})`;
        } else {
            replacement.textContent = text;
        }
        link.replaceWith(replacement);
    });

    return elementCopy.textContent.trim().replace(/\n\s*\n/g, '\n\n');
}

function extractTableMarkdown(tableElement) {
    if (!tableElement || tableElement.tagName.toLowerCase() !== 'table') {
        return '';
    }

    let tableMarkdown = '';
    
    const thead = tableElement.querySelector('thead');
    const headerRows = thead ? thead.querySelectorAll('tr') : [];
    
    if (headerRows.length > 0) {
        headerRows.forEach(row => {
            const cells = row.querySelectorAll('th, td');
            const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
            tableMarkdown += `| ${cellTexts.join(' | ')} |\n`;
            
            if (row === headerRows[0]) {
                const separators = cellTexts.map(() => '---');
                tableMarkdown += `| ${separators.join(' | ')} |\n`;
            }
        });
    }
    
    const tbody = tableElement.querySelector('tbody');
    const bodyRows = tbody ? tbody.querySelectorAll('tr') : tableElement.querySelectorAll('tr');
    
    bodyRows.forEach(row => {
        if (thead && thead.contains(row)) return;
        
        const cells = row.querySelectorAll('td, th');
        const cellTexts = Array.from(cells).map(cell => {
            return cell.textContent.trim().replace(/\n/g, ' ');
        });
        
        if (cellTexts.length > 0) {
            tableMarkdown += `| ${cellTexts.join(' | ')} |\n`;
        }
    });
    
    return tableMarkdown;
}

// ─────────────────────────────────────────────────────────────────────────────
// 마크다운 생성 (통합)
// ─────────────────────────────────────────────────────────────────────────────

function generateFullMarkdown(service, options) {
    const serviceModule = window.UniversalAIAssistant.serviceModule;
    if (!serviceModule) {
        throw new Error('서비스 모듈이 로드되지 않았습니다');
    }
    
    const serviceInfo = getServiceDisplayInfo(service);
    const title = (typeof serviceModule.extractTitle === 'function') ? 
        serviceModule.extractTitle() : `${serviceInfo.name} 대화`;
    
    let markdown = `# ${title}\n\n`;
    
    // 타임스탬프 및 메타데이터 추가
    if (options.includeTimestamp) {
        const timestamp = new Date().toLocaleString('ko-KR');
        markdown += `*내보낸 날짜: ${timestamp}*\n`;
        markdown += `*서비스: ${serviceInfo.emoji} ${serviceInfo.name}*\n`;
        markdown += `*URL: ${window.location.href}*\n\n`;
        markdown += '---\n\n';
    }
    
    // 대화 내용 생성
    if (typeof serviceModule.generateMarkdown === 'function') {
        const content = serviceModule.generateMarkdown(
            options.includeUserMessages,
            options.includeAssistantMessages
        );
        markdown += content;
    } else {
        markdown += '대화 내용을 추출할 수 없습니다.';
    }
    
    // 푸터 추가
    markdown += '\n\n---\n\n';
    markdown += '*Universal AI Assistant로 내보냄*\n';
    
    return markdown;
}

// ─────────────────────────────────────────────────────────────────────────────
// 강력한 입력 핸들러 클래스
// ─────────────────────────────────────────────────────────────────────────────

class RobustInputHandler {
    constructor(serviceName) {
        this.serviceName = serviceName;
    }

    async typeMessageRobust(inputElement, message) {
        debugLog('input', `${this.serviceName} - Starting robust typing`);
        
        const methods = [
            () => this.method1_ProseMirrorSpecific(inputElement, message),
            () => this.method2_StandardInput(inputElement, message),
            () => this.method3_EventSimulation(inputElement, message),
            () => this.method4_ClipboardPaste(inputElement, message),
            () => this.method5_DirectManipulation(inputElement, message)
        ];
        
        for (let i = 0; i < methods.length; i++) {
            try {
                debugLog('input', `${this.serviceName} - Trying method ${i + 1}`);
                await methods[i]();
                
                if (await this.verifyInput(inputElement, message)) {
                    debugLog('input', `${this.serviceName} - Method ${i + 1} successful`);
                    return true;
                }
            } catch (error) {
                debugLog('input', `${this.serviceName} - Method ${i + 1} failed:`, error.message);
            }
            await this.sleep(200);
        }
        
        throw new Error('모든 입력 방법이 실패했습니다');
    }

    async method1_ProseMirrorSpecific(inputElement, message) {
        if (!inputElement.classList.contains('ProseMirror')) {
            throw new Error('ProseMirror 엘리먼트가 아닙니다');
        }
        
        inputElement.innerHTML = '';
        await this.sleep(100);
        
        const p = document.createElement('p');
        p.textContent = message;
        inputElement.appendChild(p);
        
        // 커서 위치 설정
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(p);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        
        // 이벤트 발생
        this.dispatchInputEvents(inputElement);
    }

    async method2_StandardInput(inputElement, message) {
        inputElement.focus();
        await this.sleep(100);
        
        if (inputElement.tagName.toLowerCase() === 'textarea') {
            const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
            if (descriptor && descriptor.set) {
                descriptor.set.call(inputElement, message);
            } else {
                inputElement.value = message;
            }
        } else if (inputElement.contentEditable === 'true') {
            inputElement.textContent = message;
        }
        
        this.dispatchInputEvents(inputElement);
    }

    async method3_EventSimulation(inputElement, message) {
        inputElement.focus();
        await this.sleep(100);
        
        // 전체 선택 후 삭제
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { 
            key: 'a', ctrlKey: true, bubbles: true 
        }));
        await this.sleep(50);
        
        // 한 글자씩 입력
        for (const char of message) {
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { 
                key: char, bubbles: true 
            }));
            
            if (inputElement.tagName.toLowerCase() === 'textarea') {
                inputElement.value += char;
            } else {
                inputElement.textContent += char;
            }
            
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            await this.sleep(20);
        }
    }

    async method4_ClipboardPaste(inputElement, message) {
        try {
            await navigator.clipboard.writeText(message);
            inputElement.focus();
            await this.sleep(100);
            
            // 전체 선택
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'a', ctrlKey: true, bubbles: true 
            }));
            await this.sleep(50);
            
            // 붙여넣기
            inputElement.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'v', ctrlKey: true, bubbles: true 
            }));
            await this.sleep(200);
            
            // 검증 실패 시 직접 설정
            if (!this.verifyCurrentContent(inputElement, message)) {
                if (inputElement.tagName.toLowerCase() === 'textarea') {
                    inputElement.value = message;
                } else {
                    inputElement.textContent = message;
                }
                this.dispatchInputEvents(inputElement);
            }
        } catch (error) {
            throw new Error('클립보드 방식 실패: ' + error.message);
        }
    }

    async method5_DirectManipulation(inputElement, message) {
        if (inputElement.tagName.toLowerCase() === 'textarea') {
            inputElement.value = message;
        } else {
            inputElement.textContent = message;
            inputElement.innerHTML = this.escapeHtml(message);
        }
        
        this.dispatchInputEvents(inputElement);
    }

    dispatchInputEvents(inputElement) {
        const events = ['input', 'change', 'keyup', 'paste', 'textInput', 'compositionend'];
        events.forEach(eventType => {
            try {
                const event = new Event(eventType, { bubbles: true });
                inputElement.dispatchEvent(event);
            } catch (error) {
                debugLog('input', `Failed to dispatch ${eventType}:`, error);
            }
        });
        
        // React 스타일 이벤트
        try {
            const reactEvent = new Event('input', { bubbles: true });
            reactEvent.simulated = true;
            inputElement.dispatchEvent(reactEvent);
        } catch (error) {
            debugLog('input', 'Failed to dispatch React event:', error);
        }
    }

    async verifyInput(inputElement, expected) {
        await this.sleep(300);
        return this.verifyCurrentContent(inputElement, expected);
    }

    verifyCurrentContent(inputElement, expected) {
        const current = inputElement.value || inputElement.textContent || inputElement.innerText || '';
        const similarity = this.calculateSimilarity(current.trim(), expected);
        debugLog('input', `${this.serviceName} - Input verification: ${similarity}% similarity`);
        return similarity > 70;
    }

    calculateSimilarity(str1, str2) {
        if (str1 === str2) return 100;
        if (str1.length === 0 && str2.length === 0) return 100;
        if (str1.length === 0 || str2.length === 0) return 0;
        if (str1.includes(str2) || str2.includes(str1)) return 90;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) return 100;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return Math.round(((longer.length - distance) / longer.length) * 100);
    }

    levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 강력한 버튼 클릭 핸들러 클래스
// ─────────────────────────────────────────────────────────────────────────────

class RobustButtonClicker {
    constructor(serviceName) {
        this.serviceName = serviceName;
    }

    async clickSendButtonRobust(sendButton, inputElement) {
        debugLog('click', `${this.serviceName} - Starting robust button click`);
        
        await this.ensureButtonVisible(sendButton);
        await this.waitForButtonEnabled(sendButton);

        const methods = [
            () => this.method1_DirectClick(sendButton),
            () => this.method2_MouseEvent(sendButton),
            () => this.method3_EnterKey(inputElement),
            () => this.method4_FormSubmit(sendButton),
            () => this.method5_KeyboardTrigger(sendButton),
            () => this.method6_ForceClick(sendButton)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                debugLog('click', `${this.serviceName} - Trying click method ${i + 1}`);
                await methods[i]();
                
                if (await this.verifyClickSuccess(sendButton)) {
                    debugLog('click', `${this.serviceName} - Click method ${i + 1} successful`);
                    return true;
                }
            } catch (error) {
                debugLog('click', `${this.serviceName} - Click method ${i + 1} failed:`, error.message);
            }
            await this.sleep(200);
        }

        debugLog('click', `${this.serviceName} - All click methods completed, assuming success`);
        return true;
    }

    async method1_DirectClick(button) {
        button.click();
        await this.sleep(100);
    }

    async method2_MouseEvent(button) {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        const events = ['mousedown', 'mouseup', 'click'];
        for (const eventType of events) {
            button.dispatchEvent(new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            }));
            await this.sleep(50);
        }
    }

    async method3_EnterKey(inputElement) {
        if (!inputElement) return;
        
        inputElement.focus();
        await this.sleep(100);
        
        // Ctrl+Enter 시도
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { 
            key: 'Enter', ctrlKey: true, bubbles: true 
        }));
        await this.sleep(100);
        
        // 일반 Enter 시도
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { 
            key: 'Enter', bubbles: true 
        }));
    }

    async method4_FormSubmit(button) {
        const form = button.closest('form');
        if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true }));
        }
    }

    async method5_KeyboardTrigger(button) {
        button.focus();
        await this.sleep(100);
        
        // Enter 키
        button.dispatchEvent(new KeyboardEvent('keydown', { 
            key: 'Enter', bubbles: true 
        }));
        await this.sleep(50);
        
        // Space 키
        button.dispatchEvent(new KeyboardEvent('keydown', { 
            key: ' ', bubbles: true 
        }));
    }

    async method6_ForceClick(button) {
        // 강제로 버튼 활성화
        button.disabled = false;
        button.removeAttribute('disabled');
        button.style.pointerEvents = 'auto';
        await this.sleep(100);
        
        // 원형 클릭 메서드 호출
        HTMLElement.prototype.click.call(button);
    }

    async ensureButtonVisible(button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.sleep(300);
    }

    async waitForButtonEnabled(button, timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (!button.disabled && 
                button.style.pointerEvents !== 'none' &&
                !button.classList.contains('disabled')) {
                return true;
            }
            await this.sleep(200);
        }
        
        debugLog('click', `${this.serviceName} - Button not enabled, but continuing`);
        return false;
    }

    async verifyClickSuccess(button, timeout = 3000) {
        const startTime = Date.now();
        
        const indicators = [
            () => button.disabled,
            () => button.classList.contains('disabled'),
            () => document.querySelector('.loading, .animate-pulse'),
            () => document.querySelector('[data-testid="stop-button"]'),
            () => document.querySelector('.result-streaming'),
            () => document.querySelector('[data-is-streaming="true"]')
        ];
        
        while (Date.now() - startTime < timeout) {
            for (const indicator of indicators) {
                try {
                    if (indicator()) {
                        return true;
                    }
                } catch (error) {
                    // 개별 지표 확인 실패는 무시
                }
            }
            await this.sleep(200);
        }
        
        return true; // 타임아웃 시에도 성공으로 간주
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 기본 인터페이스 클래스
// ─────────────────────────────────────────────────────────────────────────────

class BaseAISiteInterface {
    constructor(siteName) {
        this.siteName = siteName;
        this.inputHandler = new RobustInputHandler(siteName);
        this.buttonClicker = new RobustButtonClicker(siteName);
        this.isSending = false;
        this.extensionEnabled = window.UniversalAIAssistant.extensionEnabled;
        
        // DOM 변화 관찰자
        this.domObserver = null;
        this.periodicChecker = null;
        
        this.init();
    }

    async init() {
        debugLog('interface', `${this.siteName} - BaseAISiteInterface initializing`);
        
        // 확장 프로그램 설정 로드
        await this.loadExtensionState();
        
        // DOM 변화 감지 설정
        this.observeDOMChanges();
        
        // 주기적 연결 확인 설정
        this.startPeriodicCheck();
        
        // 초기 연결 확인
        setTimeout(() => {
            this.checkConnection().then(isConnected => {
                debugLog('interface', `${this.siteName} - Initial connection check: ${isConnected}`);
            }).catch(error => {
                debugLog('interface', `${this.siteName} - Initial connection check failed:`, error);
            });
        }, 3000);
    }

    async loadExtensionState() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            if (result.settings && typeof result.settings.extensionEnabled === 'boolean') {
                this.extensionEnabled = result.settings.extensionEnabled;
                window.UniversalAIAssistant.extensionEnabled = result.settings.extensionEnabled;
            }
            debugLog('interface', `${this.siteName} - Extension state loaded: ${this.extensionEnabled}`);
        } catch (error) {
            debugLog('interface', `${this.siteName} - Failed to load extension state:`, error);
        }
    }

    observeDOMChanges() {
        if (this.domObserver) {
            this.domObserver.disconnect();
        }

        this.domObserver = new MutationObserver(debounce(() => {
            const hasRelevantChanges = this.checkForRelevantChanges();
            if (hasRelevantChanges) {
                debugLog('interface', `${this.siteName} - Relevant DOM changes detected`);
                this.checkConnection();
            }
        }, 1000));

        this.domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-testid', 'aria-label']
        });

        debugLog('interface', `${this.siteName} - DOM observer setup complete`);
    }

    checkForRelevantChanges() {
        // 서비스별로 오버라이드 가능한 메서드
        // 기본적으로는 메시지 관련 요소의 변화를 감지
        const relevantSelectors = [
            'textarea', 'input[type="text"]', '[contenteditable="true"]',
            'button[type="submit"]', '[data-testid*="send"]', '[data-testid*="submit"]',
            '.message', '.chat-message', '[data-testid*="message"]'
        ];

        return relevantSelectors.some(selector => {
            try {
                return document.querySelector(selector) !== null;
            } catch {
                return false;
            }
        });
    }

    startPeriodicCheck() {
        if (this.periodicChecker) {
            clearInterval(this.periodicChecker);
        }

        this.periodicChecker = setInterval(async () => {
            try {
                await this.loadExtensionState();
                const isConnected = await this.checkConnection();
                debugLog('interface', 
                    `${this.siteName} - Periodic check: connected=${isConnected}, enabled=${this.extensionEnabled}`
                );
            } catch (error) {
                debugLog('interface', `${this.siteName} - Periodic check error:`, error);
            }
        }, 30000); // 30초마다 체크
    }

    async waitForResponse(timeout = 30000) {
        const startTime = Date.now();
        let sawLoading = false;
        
        while (Date.now() - startTime < timeout) {
            const loadingElement = this.findElement(this.getSelectors().loadingIndicator);
            
            if (loadingElement) {
                sawLoading = true;
            } else if (sawLoading) {
                // 로딩이 끝났으면 조금 더 대기
                await this.sleep(2000);
                return;
            }
            
            await this.sleep(1000);
        }
        
        if (!sawLoading) {
            // 로딩 상태를 보지 못했다면 그냥 반환
            return;
        }
        
        throw new Error(`${this.siteName} 응답 대기 시간 초과`);
    }

    // 공통 유틸리티 메서드들 (Multi-Chat에서 가져옴)
    findElement(selectors) {
        return findElement(selectors);
    }

    findElements(selectors) {
        return findElements(selectors);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    destroy() {
        if (this.domObserver) {
            this.domObserver.disconnect();
            this.domObserver = null;
        }
        
        if (this.periodicChecker) {
            clearInterval(this.periodicChecker);
            this.periodicChecker = null;
        }
        
        debugLog('interface', `${this.siteName} - Interface destroyed`);
    }

    // ─── 하위 클래스에서 구현해야 할 메서드들 ───
    
    getSelectors() {
        throw new Error(`${this.siteName}: getSelectors() must be implemented by subclass`);
    }

    async checkConnection() {
        throw new Error(`${this.siteName}: checkConnection() must be implemented by subclass`);
    }

    async testConnection() {
        throw new Error(`${this.siteName}: testConnection() must be implemented by subclass`);
    }

    async sendMessage(message) {
        throw new Error(`${this.siteName}: sendMessage() must be implemented by subclass`);
    }

    async getLatestResponse() {
        throw new Error(`${this.siteName}: getLatestResponse() must be implemented by subclass`);
    }

    // MD Export 관련 메서드들 (선택적 구현)
    getConversationData() {
        // 기본 구현 제공
        return {
            title: this.extractTitle ? this.extractTitle() : `${this.siteName} 대화`,
            userMessages: 0,
            assistantMessages: 0,
            totalMessages: 0,
            serviceName: this.siteName,
            detectionMethod: 'base-implementation'
        };
    }

    generateMarkdown(includeUser, includeAssistant) {
        // 기본 구현 제공
        return `${this.siteName} 대화 내용을 추출할 수 없습니다.`;
    }

    extractTitle() {
        // 기본 제목 추출 로직
        const titleSources = [
            () => document.title.replace(new RegExp(this.siteName, 'gi'), '').trim(),
            () => document.querySelector('h1')?.textContent?.trim(),
            () => document.querySelector('[role="heading"]')?.textContent?.trim()
        ];

        for (const source of titleSources) {
            try {
                const title = source();
                if (title && title.length > 0) {
                    return title;
                }
            } catch (error) {
                debugLog('title', `${this.siteName} - Title extraction error:`, error);
            }
        }

        return `${this.siteName} 대화`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 서비스 초기화 관리
// ─────────────────────────────────────────────────────────────────────────────

function initializeService() {
    const service = detectAIService();
    
    if (!service) {
        debugLog('init', 'No supported AI service detected');
        return;
    }

    debugLog('init', `Initializing service: ${service}`);
    
    // 기존 인터페이스 정리
    if (window.UniversalAIAssistant.serviceModule) {
        try {
            if (typeof window.UniversalAIAssistant.serviceModule.destroy === 'function') {
                window.UniversalAIAssistant.serviceModule.destroy();
            }
        } catch (error) {
            debugLog('init', 'Error destroying existing interface:', error);
        }
    }
    
    // 서비스 모듈이 window 객체에 등록되었는지 확인
    const moduleCheckInterval = setInterval(() => {
        if (window.aiServiceModule) {
            window.UniversalAIAssistant.serviceModule = window.aiServiceModule;
            window.UniversalAIAssistant.currentService = service;
            window.UniversalAIAssistant.initialized = true;
            
            debugLog('init', `Service module loaded for ${service}`);
            
            // 서비스별 초기화 함수 호출
            if (typeof window.aiServiceModule.initialize === 'function') {
                window.aiServiceModule.initialize();
            }
            
            clearInterval(moduleCheckInterval);
        }
    }, 100);
    
    // 10초 후 타임아웃
    setTimeout(() => {
        clearInterval(moduleCheckInterval);
        if (!window.UniversalAIAssistant.serviceModule) {
            debugLog('init', `Service module loading timeout for ${service}`);
        }
    }, 10000);
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸리티 함수들
// ─────────────────────────────────────────────────────────────────────────────

function debugLog(category, message, data = null) {
    // 디버그 모드일 때만 로그 출력
    if (window.UniversalAIAssistant.settings.debugMode) {
        const timestamp = new Date().toISOString();
        const logMessage = `[Universal AI Assistant] [${timestamp}] [${category.toUpperCase()}] ${message}`;
        
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

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
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// SPA 네비게이션 감지 및 초기화
// ─────────────────────────────────────────────────────────────────────────────

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    debugLog('init', 'DOM loaded, initializing...');
    setTimeout(() => {
        loadExtensionSettings().then(() => {
            initializeService();
        });
    }, 500);
});

// 페이지 완전 로드 시 추가 초기화
window.addEventListener('load', function() {
    debugLog('init', 'Window loaded, additional initialization...');
    setTimeout(initializeService, 1000);
});

// SPA 네비게이션 감지
const navigationObserver = new MutationObserver(debounce(() => {
    const currentUrl = location.href;
    if (currentUrl !== window.UniversalAIAssistant.lastUrl) {
        window.UniversalAIAssistant.lastUrl = currentUrl;
        const service = detectAIService();
        
        debugLog('navigation', `URL changed to: ${currentUrl}, detected service: ${service}`);
        
        // 서비스 변경 시 재초기화
        if (service && service !== window.UniversalAIAssistant.currentService) {
            window.UniversalAIAssistant.initialized = false;
            window.UniversalAIAssistant.serviceModule = null;
            setTimeout(initializeService, 1000);
        }
    }
}, 1000));

navigationObserver.observe(document, { 
    subtree: true, 
    childList: true,
    attributes: true,
    attributeFilter: ['data-pathname', 'data-route']
});

// ─────────────────────────────────────────────────────────────────────────────
// 전역 디버그 및 유틸리티 함수
// ─────────────────────────────────────────────────────────────────────────────

// 전역 네임스페이스에 공통 클래스들 노출
window.UniversalAIAssistant.BaseAISiteInterface = BaseAISiteInterface;
window.UniversalAIAssistant.RobustInputHandler = RobustInputHandler;
window.UniversalAIAssistant.RobustButtonClicker = RobustButtonClicker;

// 전역 디버그 함수
window.debugUniversalAI = function() {
    const service = detectAIService();
    console.log('=== Universal AI Assistant Debug ===');
    console.log('Current URL:', window.location.href);
    console.log('Service detected:', service);
    console.log('Extension state:', window.UniversalAIAssistant);
    console.log('Service module loaded:', !!window.UniversalAIAssistant.serviceModule);
    console.log('Extension enabled:', window.UniversalAIAssistant.extensionEnabled);
    
    if (window.UniversalAIAssistant.serviceModule) {
        try {
            // Multi-Chat 기능 테스트
            if (typeof window.UniversalAIAssistant.serviceModule.checkConnection === 'function') {
                window.UniversalAIAssistant.serviceModule.checkConnection().then(connected => {
                    console.log('Connection status:', connected);
                });
            }
            
            // MD Export 기능 테스트
            if (typeof window.UniversalAIAssistant.serviceModule.getConversationData === 'function') {
                const data = window.UniversalAIAssistant.serviceModule.getConversationData();
                console.log('Conversation data:', data);
            }
        } catch (error) {
            console.log('Debug test error:', error);
        }
    }
};

// 간단한 디버그 함수
window.quickDebugAI = function() {
    const service = detectAIService();
    const enabled = window.UniversalAIAssistant.extensionEnabled;
    const initialized = window.UniversalAIAssistant.initialized;
    
    console.log(`🤖 Universal AI Assistant`);
    console.log(`   Service: ${service || 'None'}`);
    console.log(`   Enabled: ${enabled}`);
    console.log(`   Initialized: ${initialized}`);
    console.log(`   URL: ${window.location.href}`);
};

// 에러 핸들링
window.addEventListener('error', function(event) {
    debugLog('error', 'Global error occurred', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

window.addEventListener('unhandledrejection', function(event) {
    debugLog('error', 'Unhandled promise rejection', {
        reason: event.reason
    });
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    if (window.UniversalAIAssistant.serviceModule && 
        typeof window.UniversalAIAssistant.serviceModule.destroy === 'function') {
        try {
            window.UniversalAIAssistant.serviceModule.destroy();
        } catch (error) {
            debugLog('cleanup', 'Error during cleanup:', error);
        }
    }
    
    if (navigationObserver) {
        navigationObserver.disconnect();
    }
});

debugLog('init', 'Universal AI Assistant common content script loaded');

// ─────────────────────────────────────────────────────────────────────────────
// 모듈 내보내기 (다른 스크립트에서 사용할 수 있도록)
// ─────────────────────────────────────────────────────────────────────────────

// 전역 객체에 유틸리티 함수들 추가
window.UniversalAIAssistant.utils = {
    debugLog,
    debounce,
    waitForElement,
    detectAIService,
    getServiceDisplayInfo,
    findElement,
    findElements,
    isElementVisible,
    extractTextFromElement,
    extractTableMarkdown,
    generateFullMarkdown,
    loadExtensionSettings,
    saveExtensionSettings
};

console.log('🚀 Universal AI Assistant - Common Content Script 로드 완료');