// ─────────────────────────────────────────────────────────────────────────────
// Universal AI Assistant - ChatGPT Service Module
// Multi-Chat + MD Export 통합 기능
// ─────────────────────────────────────────────────────────────────────────────

// ChatGPT URL 핸들러 클래스 (자동 새 채팅 이동)
class ChatGPTURLHandler {
    constructor(aiSiteInterface) {
        this.aiSiteInterface = aiSiteInterface;
        this.checkAndRedirectIfNeeded();
    }

    async checkAndRedirectIfNeeded() {
        if (!this.aiSiteInterface?.extensionEnabled) {
            debugLog('chatgpt', '확장 프로그램이 비활성화되어 새 채팅 자동 클릭을 하지 않습니다.');
            return;
        }

        const href = window.location.href;
        const pathname = window.location.pathname;
        
        // ChatGPT 홈 화면 감지 (대화가 없는 상태)
        if ((href.startsWith('https://chatgpt.com/') && !href.includes('/c/')) ||
            (href.startsWith('https://chat.openai.com/') && (pathname === '/' || !pathname.includes('/c/')))) {
            
            debugLog('chatgpt', 'ChatGPT 홈 화면 감지 - 새 채팅 페이지로 이동 준비');
            this.waitForNewChatButton();
        }
    }

    waitForNewChatButton() {
        let attempts = 0;
        const maxAttempts = 25;
        
        const checkInterval = setInterval(() => {
            if (!this.aiSiteInterface?.extensionEnabled) {
                debugLog('chatgpt', '확장 프로그램이 비활성화되어 새 채팅 자동 클릭을 중단합니다.');
                clearInterval(checkInterval);
                return;
            }

            attempts++;
            let clicked = false;

            // 새 채팅 버튼 클릭 시도 (여러 방법)
            const clickMethods = [
                // 방법 1: 영어 UI 셀렉터
                () => {
                    const selectors = [
                        'button[aria-label="New chat"]',
                        'a[href="/chat"]',
                        'button:has(svg[aria-label="New chat"])',
                        'a[data-testid="new-chat-button"]'
                    ];
                    
                    for (const selector of selectors) {
                        const elem = document.querySelector(selector);
                        if (elem && elem instanceof HTMLElement) {
                            debugLog('chatgpt', `"New chat" 버튼 발견 (${selector}), 자동 클릭`);
                            elem.click();
                            return true;
                        }
                    }
                    return false;
                },
                
                // 방법 2: 한글 UI - data-testid
                () => {
                    const createLink = document.querySelector('a[data-testid="create-new-chat-button"]');
                    if (createLink && createLink instanceof HTMLElement) {
                        debugLog('chatgpt', '"새 채팅" 버튼 발견 (data-testid), 자동 클릭');
                        createLink.click();
                        return true;
                    }
                    return false;
                },
                
                // 방법 3: 한글 UI - innerText 기반
                () => {
                    const allAnchors = Array.from(document.querySelectorAll('a, button'));
                    for (const element of allAnchors) {
                        const text = element.innerText?.trim();
                        if (text === '새 채팅' || text === 'New chat') {
                            debugLog('chatgpt', `"${text}" 버튼 발견 (innerText), 자동 클릭`);
                            element.click();
                            return true;
                        }
                    }
                    return false;
                },
                
                // 방법 4: 클래스 기반 검색
                () => {
                    const selectors = [
                        '.new-chat-button',
                        '[class*="new-chat"]',
                        '[class*="create-chat"]'
                    ];
                    
                    for (const selector of selectors) {
                        const elem = document.querySelector(selector);
                        if (elem && elem instanceof HTMLElement) {
                            debugLog('chatgpt', `새 채팅 버튼 발견 (${selector}), 자동 클릭`);
                            elem.click();
                            return true;
                        }
                    }
                    return false;
                }
            ];

            // 모든 방법 시도
            for (const method of clickMethods) {
                try {
                    if (method()) {
                        clicked = true;
                        break;
                    }
                } catch (error) {
                    debugLog('chatgpt', '새 채팅 버튼 클릭 방법 실패:', error);
                }
            }

            if (clicked || attempts >= maxAttempts) {
                clearInterval(checkInterval);
                
                if (clicked) {
                    debugLog('chatgpt', '새 채팅 클릭 성공, 인터페이스 재확인 예약');
                    setTimeout(() => {
                        if (window.aiSiteInterface && 
                            typeof window.aiSiteInterface.checkConnection === 'function') {
                            window.aiSiteInterface.checkConnection();
                        }
                    }, 2000);
                } else {
                    debugLog('chatgpt', '새 채팅 버튼을 찾지 못했습니다.');
                }
            }
        }, 1000);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatGPT 전용 인터페이스 클래스
// ─────────────────────────────────────────────────────────────────────────────

class ChatGPTInterface extends window.UniversalAIAssistant.BaseAISiteInterface {
    constructor() {
        super('ChatGPT');
        this.urlHandler = new ChatGPTURLHandler(this);
        this.lastMessageCount = 0;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 셀렉터 정의 (ChatGPT 특화)
    // ─────────────────────────────────────────────────────────────────────────────

    getSelectors() {
        return {
            messageInput: [
                // 최신 ChatGPT UI
                'div.ProseMirror[contenteditable="true"]',
                'div[contenteditable="true"][data-testid="prompt-textarea"]',
                'textarea[data-testid="prompt-textarea"]',
                'div[contenteditable="true"].ProseMirror#prompt-textarea',
                
                // 대체 셀렉터들
                'div[contenteditable="true"][placeholder*="Message ChatGPT"]',
                'div[contenteditable="true"][placeholder*="메시지"]',
                '#prompt-textarea',
                'div[contenteditable="true"]',
                'textarea[placeholder*="Message"]',
                'textarea'
            ],
            
            sendButton: [
                // 최신 UI
                'button[data-testid="send-button"]',
                'button[data-testid="composer-send-button"]',
                
                // aria-label 기반
                'button[aria-label*="Send message"]',
                'button[aria-label*="메시지 전송"]',
                
                // SVG 기반
                'button:has(svg[data-testid="send-icon"])',
                'button:has(svg[viewBox="0 0 24 24"]):not([disabled])',
                'button:has(path[d*="M2.01"])',
                
                // 폼 기반
                'form button[type="submit"]:not([disabled])',
                'button[type="submit"]:not([disabled])',
                
                // 구조 기반
                'div[data-testid="composer"] button:last-child',
                '.composer button[aria-label*="Send"]',
                
                // 클래스 기반
                'button[class*="send"]',
                'button[class*="submit"]'
            ],
            
            responseContainer: [
                // 최신 UI - role 기반
                '[data-message-author-role="assistant"]',
                '[data-testid="conversation-turn-content"]',
                
                // message-id 기반
                '[data-message-id]',
                
                // 클래스 기반
                '.prose:not(.result-streaming)',
                '.group.w-full .markdown',
                '.conversation-content .prose',
                
                // testid 기반
                '[data-testid="message-content"]'
            ],
            
            loadingIndicator: [
                // 스트리밍 상태
                '.result-streaming',
                '[data-testid="stop-button"]',
                '.animate-pulse',
                
                // aria-label 기반
                '[aria-label*="Stop generating"]',
                '[aria-label*="생성 중지"]',
                
                // 클래스 기반
                '.loading-message',
                '.generating-response',
                '.streaming-response'
            ],
            
            conversationTurn: [
                '[data-testid^="conversation-turn-"]',
                '.conversation-turn',
                '[data-message-author-role]'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 연결 확인 (Multi-Chat 기능)
    // ─────────────────────────────────────────────────────────────────────────────

    async checkConnection() {
        try {
            if (!this.extensionEnabled) {
                return false;
            }

            // 로그인 상태 확인
            const isLoggedIn = !document.querySelector([
                '.auth-button', 
                '[data-testid="login-button"]', 
                '.login-button',
                '.sign-in-button'
            ].join(', '));

            // 입력창 존재 확인
            const inputEl = this.findElement(this.getSelectors().messageInput);
            
            // 홈 화면이 아닌 대화 페이지인지 확인
            const isInConversation = this.isInConversationPage();
            
            const isConnected = isLoggedIn && !!inputEl && isInConversation;
            
            debugLog('chatgpt', 'Connection check result:', {
                isLoggedIn,
                hasInput: !!inputEl,
                isInConversation,
                isConnected
            });
            
            return isConnected;
            
        } catch (error) {
            debugLog('chatgpt', 'checkConnection 오류:', error);
            return false;
        }
    }

    isInConversationPage() {
        const href = window.location.href;
        const pathname = window.location.pathname;
        
        // 대화 페이지 패턴 확인
        const isConversationUrl = href.includes('/c/') || pathname.includes('/c/');
        
        // 또는 대화 턴이 존재하는지 확인
        const hasConversationTurns = document.querySelectorAll(
            this.getSelectors().conversationTurn.join(', ')
        ).length > 0;
        
        return isConversationUrl || hasConversationTurns;
    }

    async testConnection() {
        try {
            if (!this.extensionEnabled) {
                return {
                    success: false,
                    error: '확장 프로그램이 비활성화되어 있습니다.'
                };
            }

            const inputEl = this.findElement(this.getSelectors().messageInput);
            const sendBtn = this.findElement(this.getSelectors().sendButton);
            
            // 홈 화면인지 확인
            if (!this.isInConversationPage()) {
                return {
                    success: false,
                    error: 'ChatGPT 홈 화면입니다. 새 채팅을 자동으로 시작 중이므로 잠시 기다려주세요.'
                };
            }
            
            if (!inputEl) {
                return { 
                    success: false, 
                    error: '메시지 입력창을 찾을 수 없습니다' 
                };
            }
            
            if (!sendBtn) {
                return { 
                    success: false, 
                    error: '전송 버튼을 찾을 수 없습니다' 
                };
            }
            
            // 입력창 포커스 테스트
            inputEl.focus();
            await this.sleep(100);
            
            return {
                success: true,
                message: 'ChatGPT 연결 테스트 성공',
                details: {
                    site: this.siteName,
                    inputTag: inputEl.tagName.toLowerCase(),
                    inputClasses: inputEl.className,
                    buttonFound: true,
                    url: window.location.href,
                    extensionEnabled: this.extensionEnabled
                }
            };
            
        } catch (error) {
            debugLog('chatgpt', 'testConnection 오류:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 메시지 전송 (Multi-Chat 기능)
    // ─────────────────────────────────────────────────────────────────────────────

    async sendMessage(message) {
        try {
            if (!this.extensionEnabled) {
                debugLog('chatgpt', 'sendMessage 차단: 확장 프로그램이 비활성화됨');
                return { 
                    success: false, 
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName,
                    extensionDisabled: true
                };
            }

            if (this.isSending) {
                debugLog('chatgpt', 'sendMessage 호출 중복 방지: 이미 전송 중입니다.');
                return { 
                    success: false, 
                    error: '전송 대기 중입니다.' 
                };
            }
            
            this.isSending = true;
            debugLog('chatgpt', '메시지 전송 시도:', message.substring(0, 50) + '...');

            // 홈 화면에서 새 채팅 시작 처리
            let inputEl = this.findElement(this.getSelectors().messageInput);
            
            if (!inputEl || !this.isInConversationPage()) {
                debugLog('chatgpt', '홈 화면 감지, 새 채팅 시작 시도');
                
                if (!this.extensionEnabled) {
                    throw new Error('확장 프로그램이 비활성화되어 있어 새 채팅을 시작할 수 없습니다.');
                }

                await this.startNewChat();
                
                // 새 채팅 시작 후 입력창 재검색
                const maxWaitTime = 8000;
                const startTime = Date.now();
                
                while (Date.now() - startTime < maxWaitTime) {
                    inputEl = this.findElement(this.getSelectors().messageInput);
                    if (inputEl && this.isInConversationPage()) {
                        debugLog('chatgpt', '새 채팅에서 입력창 발견');
                        break;
                    }
                    await this.sleep(500);
                }
                
                if (!inputEl) {
                    throw new Error('새 채팅 시작 후에도 입력창을 찾을 수 없습니다.');
                }
            }

            // 메시지 입력
            await this.inputHandler.typeMessageRobust(inputEl, message);
            await this.sleep(1000);

            // 전송 버튼 클릭
            const sendBtn = this.findElement(this.getSelectors().sendButton);
            if (sendBtn) {
                await this.buttonClicker.clickSendButtonRobust(sendBtn, inputEl);
            } else {
                // 버튼이 없으면 Enter 키로 전송
                inputEl.focus();
                await this.sleep(200);
                inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true
                }));
            }

            debugLog('chatgpt', '메시지 전송 완료');
            return { 
                success: true, 
                message: '메시지 전송 완료', 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };

        } catch (error) {
            debugLog('chatgpt', 'sendMessage 오류:', error);
            return { 
                success: false, 
                error: error.message, 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        } finally {
            this.isSending = false;
        }
    }

    async startNewChat() {
        const newChatMethods = [
            // 방법 1: 영어 UI 버튼들
            () => {
                const selectors = [
                    'button[aria-label="New chat"]',
                    'a[href="/chat"]',
                    'button:has(svg[aria-label="New chat"])',
                    'a[data-testid="new-chat-button"]'
                ];
                
                for (const selector of selectors) {
                    const btn = document.querySelector(selector);
                    if (btn) {
                        debugLog('chatgpt', `새 채팅 버튼 클릭: ${selector}`);
                        btn.click();
                        return true;
                    }
                }
                return false;
            },
            
            // 방법 2: 한글 UI - data-testid
            () => {
                const createLink = document.querySelector('a[data-testid="create-new-chat-button"]');
                if (createLink) {
                    debugLog('chatgpt', '새 채팅 버튼 클릭 (data-testid)');
                    createLink.click();
                    return true;
                }
                return false;
            },
            
            // 방법 3: 텍스트 기반 검색
            () => {
                const allButtons = Array.from(document.querySelectorAll('a, button'));
                for (const btn of allButtons) {
                    const text = btn.innerText?.trim();
                    if (text === '새 채팅' || text === 'New chat') {
                        debugLog('chatgpt', `새 채팅 버튼 클릭 (텍스트: ${text})`);
                        btn.click();
                        return true;
                    }
                }
                return false;
            }
        ];

        for (const method of newChatMethods) {
            try {
                if (method()) {
                    await this.sleep(1500); // 새 채팅 로딩 대기
                    return true;
                }
            } catch (error) {
                debugLog('chatgpt', '새 채팅 시작 방법 실패:', error);
            }
        }

        throw new Error('새 채팅 버튼을 찾을 수 없습니다.');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 응답 수집 (Multi-Chat 기능)
    // ─────────────────────────────────────────────────────────────────────────────

    async getLatestResponse() {
        try {
            if (!this.extensionEnabled) {
                return { 
                    responseText: null, 
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName 
                };
            }

            // 응답 완료까지 대기
            await this.waitForResponse();
            
            // 응답 컨테이너 찾기
            const responseElements = this.findElements(this.getSelectors().responseContainer);
            
            if (responseElements.length === 0) {
                return { 
                    responseText: null,
                    site: this.siteName 
                };
            }
            
            // 마지막 응답 추출
            const lastResponse = responseElements[responseElements.length - 1];
            const responseText = this.extractResponseText(lastResponse);
            
            return { 
                responseText: responseText.trim(), 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
            
        } catch (error) {
            debugLog('chatgpt', 'getLatestResponse 오류:', error);
            return { 
                responseText: null, 
                error: error.message, 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        }
    }

    extractResponseText(responseElement) {
        // ChatGPT의 마크다운 컨테이너 확인
        const markdownContainer = responseElement.querySelector('.markdown.prose, .prose, [class*="markdown"]');
        
        if (markdownContainer) {
            return this.parseMarkdownContent(markdownContainer);
        }
        
        // 마크다운 컨테이너가 없으면 일반 텍스트 추출
        return window.UniversalAIAssistant.utils.extractTextFromElement(responseElement);
    }

    parseMarkdownContent(container) {
        // ChatGPT 전용 마크다운 파싱 로직
        let markdown = '';
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        const processedElements = new Set();

        while (node = walker.nextNode()) {
            if (node.nodeType === Node.ELEMENT_NODE && !processedElements.has(node)) {
                const tagName = node.tagName.toLowerCase();
                
                // 인용문 제외
                if (node.classList && node.classList.contains('citation')) {
                    processedElements.add(node);
                    continue;
                }

                switch (tagName) {
                    case 'h1':
                    case 'h2':
                    case 'h3':
                    case 'h4':
                    case 'h5':
                    case 'h6':
                        const level = parseInt(tagName.charAt(1));
                        markdown += `${'#'.repeat(level)} ${node.textContent}\n\n`;
                        processedElements.add(node);
                        break;
                        
                    case 'p':
                        if (!processedElements.has(node) && node.textContent.trim()) {
                            markdown += `${window.UniversalAIAssistant.utils.extractTextFromElement(node)}\n\n`;
                            processedElements.add(node);
                        }
                        break;
                        
                    case 'ul':
                        if (!processedElements.has(node)) {
                            node.querySelectorAll('li').forEach(li => {
                                markdown += `- ${li.textContent.trim()}\n`;
                            });
                            markdown += '\n';
                            processedElements.add(node);
                        }
                        break;
                        
                    case 'ol':
                        if (!processedElements.has(node)) {
                            node.querySelectorAll('li').forEach((li, idx) => {
                                markdown += `${idx + 1}. ${li.textContent.trim()}\n`;
                            });
                            markdown += '\n';
                            processedElements.add(node);
                        }
                        break;
                        
                    case 'pre':
                        if (!processedElements.has(node)) {
                            const code = node.querySelector('code');
                            if (code) {
                                const language = code.className.match(/language-(\w+)/)?.[1] || '';
                                markdown += `\`\`\`${language}\n${code.textContent}\n\`\`\`\n\n`;
                            }
                            processedElements.add(node);
                        }
                        break;
                        
                    case 'blockquote':
                        if (!processedElements.has(node)) {
                            node.textContent.split('\n').forEach(line => {
                                if (line.trim()) {
                                    markdown += `> ${line.trim()}\n`;
                                }
                            });
                            markdown += '\n';
                            processedElements.add(node);
                        }
                        break;
                }
            }
        }

        return markdown.trim() || window.UniversalAIAssistant.utils.extractTextFromElement(container);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 대화 데이터 추출 (MD Export 기능)
    // ─────────────────────────────────────────────────────────────────────────────

    getConversationData() {
        const title = this.extractTitle();
        
        // 대화 턴 기반 메시지 카운트
        const conversationTurns = document.querySelectorAll(
            this.getSelectors().conversationTurn.join(', ')
        );
        
        let userCount = 0;
        let assistantCount = 0;
        let totalTurns = conversationTurns.length;

        conversationTurns.forEach((turn) => {
            const userMessage = turn.querySelector('[data-message-author-role="user"]');
            const assistantMessage = turn.querySelector('[data-message-author-role="assistant"]');
            
            if (userMessage) userCount++;
            if (assistantMessage) assistantCount++;
        });

        // 폴백: role 기반 직접 카운트
        if (totalTurns === 0) {
            const allMessages = document.querySelectorAll('[data-message-author-role]');
            allMessages.forEach(msg => {
                const role = msg.getAttribute('data-message-author-role');
                if (role === 'user') userCount++;
                if (role === 'assistant') assistantCount++;
            });
            totalTurns = allMessages.length;
        }

        return {
            title: title,
            userMessages: userCount,
            assistantMessages: assistantCount,
            totalMessages: userCount + assistantCount,
            serviceName: this.siteName,
            conversationTurns: totalTurns,
            detectionMethod: totalTurns > 0 ? 'conversation-turn' : 'role-based',
            url: window.location.href
        };
    }

    extractTitle() {
        const titleSources = [
            // 활성 대화 제목
            () => {
                const activeConversation = document.querySelector([
                    '[aria-current="page"]', 
                    '.bg-token-sidebar-surface-secondary',
                    '.conversation-item.selected'
                ].join(', '));
                
                if (activeConversation) {
                    const titleElement = activeConversation.querySelector([
                        '.truncate', 
                        '.overflow-hidden',
                        '.conversation-title'
                    ].join(', '));
                    return titleElement?.textContent?.trim();
                }
            },
            
            // 헤더 제목
            () => {
                const headerTitle = document.querySelector('h1, [role="heading"]');
                if (headerTitle && headerTitle.textContent.trim() && 
                    !headerTitle.textContent.includes('ChatGPT')) {
                    return headerTitle.textContent.trim();
                }
            },
            
            // 첫 번째 사용자 메시지에서 제목 추출
            () => {
                const firstUserMessage = document.querySelector('[data-message-author-role="user"]');
                if (firstUserMessage) {
                    const text = firstUserMessage.textContent.trim();
                    const firstLine = text.split(/[.\n!?]/)[0];
                    if (firstLine.length > 10 && firstLine.length < 100) {
                        return firstLine;
                    }
                }
            },
            
            // 페이지 제목에서 추출
            () => {
                let title = document.title;
                title = title.replace(/ChatGPT\s*[-|]?\s*/gi, '')
                           .replace(/\s*[-|]?\s*ChatGPT/gi, '')
                           .trim();
                if (title && title.length > 3) {
                    return title;
                }
            }
        ];

        for (const source of titleSources) {
            try {
                const title = source();
                if (title && title.length > 0) {
                    debugLog('chatgpt', 'Title extracted:', title);
                    return title;
                }
            } catch (error) {
                debugLog('chatgpt', 'Title extraction error:', error);
            }
        }

        return 'ChatGPT 대화';
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 마크다운 생성 (MD Export 기능)
    // ─────────────────────────────────────────────────────────────────────────────

    generateMarkdown(includeUser, includeAssistant) {
        let markdown = '';
        
        // 대화 턴 기반 마크다운 생성
        const conversationTurns = document.querySelectorAll(
            this.getSelectors().conversationTurn.join(', ')
        );

        if (conversationTurns.length === 0) {
            return this.generateMarkdownFallback(includeUser, includeAssistant);
        }

        conversationTurns.forEach((turn, index) => {
            const userMessage = turn.querySelector('[data-message-author-role="user"]');
            const assistantMessage = turn.querySelector('[data-message-author-role="assistant"]');

            // 사용자 메시지 추가
            if (userMessage && includeUser) {
                const userText = window.UniversalAIAssistant.utils.extractTextFromElement(userMessage);
                if (userText.trim()) {
                    markdown += `## 👤 사용자\n\n${userText}\n\n`;
                }
            }

            // ChatGPT 응답 추가
            if (assistantMessage && includeAssistant) {
                const assistantText = this.convertAssistantMessage(assistantMessage);
                if (assistantText.trim()) {
                    markdown += `## 🤖 ChatGPT\n\n${assistantText}\n\n`;
                }
            }

            // 구분선 추가 (마지막이 아닌 경우)
            if (index < conversationTurns.length - 1 && (userMessage || assistantMessage)) {
                markdown += '---\n\n';
            }
        });

        return markdown || '대화 내용을 추출할 수 없습니다.';
    }

    generateMarkdownFallback(includeUser, includeAssistant) {
        let markdown = '';
        
        // 직접 role 기반 메시지 검색
        const allMessages = document.querySelectorAll('[data-message-author-role]');
        
        allMessages.forEach((msg, index) => {
            const role = msg.getAttribute('data-message-author-role');
            
            if (role === 'user' && includeUser) {
                const userText = window.UniversalAIAssistant.utils.extractTextFromElement(msg);
                if (userText.trim()) {
                    markdown += `## 👤 사용자\n\n${userText}\n\n`;
                }
            }
            
            if (role === 'assistant' && includeAssistant) {
                const assistantText = this.convertAssistantMessage(msg);
                if (assistantText.trim()) {
                    markdown += `## 🤖 ChatGPT\n\n${assistantText}\n\n`;
                }
            }
            
            // 구분선 추가
            if (index < allMessages.length - 1) {
                markdown += '---\n\n';
            }
        });

        return markdown || '대화 내용을 추출할 수 없습니다.';
    }

    convertAssistantMessage(assistantElement) {
        // ChatGPT 응답에서 마크다운 컨테이너 찾기
        const markdownContainer = assistantElement.querySelector([
            '.markdown.prose', 
            '.prose', 
            '[class*="markdown"]',
            '.response-content'
        ].join(', '));
        
        if (markdownContainer) {
            return this.parseMarkdownContent(markdownContainer);
        }
        
        // 마크다운 컨테이너가 없으면 일반 텍스트 추출
        return window.UniversalAIAssistant.utils.extractTextFromElement(assistantElement);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChatGPT 특화 초기화 및 이벤트 처리
    // ─────────────────────────────────────────────────────────────────────────────

    initialize() {
        debugLog('chatgpt', 'ChatGPT 모듈 초기화 시작');
        
        // 부모 클래스 초기화 호출
        super.init();
        
        // ChatGPT 특화 기능 설정
        this.setupChatGPTObserver();
        this.setupMessageCounter();
        this.detectChatGPTUIVariant();
        
        debugLog('chatgpt', 'ChatGPT 모듈 초기화 완료');
    }

    setupChatGPTObserver() {
        // ChatGPT 특화 DOM 변화 감지
        const specificObserver = new MutationObserver(
            window.UniversalAIAssistant.utils.debounce(() => {
                this.onChatGPTUIChange();
            }, 1000)
        );

        // ChatGPT 메시지 영역만 관찰
        const messageArea = document.querySelector('main, [role="main"], .conversation-content') || document.body;
        
        specificObserver.observe(messageArea, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-message-author-role', 'data-testid', 'data-message-id']
        });

        this.chatGPTObserver = specificObserver;
        debugLog('chatgpt', 'ChatGPT 특화 옵저버 설정 완료');
    }

    setupMessageCounter() {
        // 메시지 수 변화 감지
        setInterval(() => {
            try {
                const currentCount = document.querySelectorAll('[data-message-author-role]').length;
                if (currentCount !== this.lastMessageCount) {
                    debugLog('chatgpt', `메시지 수 변화 감지: ${this.lastMessageCount} → ${currentCount}`);
                    this.lastMessageCount = currentCount;
                    this.onNewMessage();
                }
            } catch (error) {
                debugLog('chatgpt', '메시지 카운터 오류:', error);
            }
        }, 2000);
    }

    detectChatGPTUIVariant() {
        // ChatGPT UI 변형 감지
        const uiVariants = {
            hasNewUI: !!document.querySelector('[data-testid="composer"]'),
            hasLegacyUI: !!document.querySelector('#prompt-textarea'),
            hasProseMirror: !!document.querySelector('.ProseMirror'),
            hasDataTestId: !!document.querySelector('[data-testid="prompt-textarea"]'),
            isLoggedIn: !document.querySelector('.auth-button, [data-testid="login-button"]'),
            hasConversationTurns: document.querySelectorAll('[data-testid^="conversation-turn-"]').length > 0
        };

        debugLog('chatgpt', 'ChatGPT UI 변형 감지 결과:', uiVariants);
        this.uiVariants = uiVariants;
        
        return uiVariants;
    }

    onChatGPTUIChange() {
        // ChatGPT UI 변화 시 호출되는 메서드
        debugLog('chatgpt', 'ChatGPT UI 변화 감지됨');
        
        // UI 변형 재감지
        this.detectChatGPTUIVariant();
        
        // 연결 상태 재확인
        this.checkConnection().then(connected => {
            debugLog('chatgpt', `UI 변화 후 연결 상태: ${connected}`);
        });
    }

    onNewMessage() {
        // 새 메시지 감지 시 호출되는 메서드
        debugLog('chatgpt', '새 메시지 감지됨');
        
        // 필요시 추가 처리 로직
        if (window.UniversalAIAssistant.settings.debugMode) {
            const conversationData = this.getConversationData();
            debugLog('chatgpt', '현재 대화 상태:', conversationData);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ChatGPT 특화 유틸리티 메서드
    // ─────────────────────────────────────────────────────────────────────────────

    checkForRelevantChanges() {
        // 부모 클래스 메서드 오버라이드
        const chatGPTSpecificSelectors = [
            '[data-testid^="conversation-turn-"]',
            '[data-message-author-role]',
            '.ProseMirror[contenteditable="true"]',
            '[data-testid="send-button"]',
            '.result-streaming'
        ];

        return chatGPTSpecificSelectors.some(selector => {
            try {
                return document.querySelector(selector) !== null;
            } catch {
                return false;
            }
        });
    }

    async waitForResponse(timeout = 45000) {
        // ChatGPT 특화 응답 대기 로직
        const startTime = Date.now();
        let sawLoading = false;
        let sawStreaming = false;
        
        debugLog('chatgpt', 'ChatGPT 응답 대기 시작');
        
        while (Date.now() - startTime < timeout) {
            // 스트리밍 상태 확인
            const isStreaming = !!document.querySelector([
                '.result-streaming',
                '[data-testid="stop-button"]',
                '[aria-label*="Stop generating"]'
            ].join(', '));
            
            // 로딩 상태 확인
            const isLoading = !!document.querySelector([
                '.animate-pulse',
                '.loading-message',
                '.generating-response'
            ].join(', '));
            
            if (isStreaming || isLoading) {
                sawLoading = true;
                sawStreaming = isStreaming;
                debugLog('chatgpt', '응답 생성 중...', { isStreaming, isLoading });
            } else if (sawLoading) {
                // 로딩/스트리밍이 끝났으면 조금 더 대기
                debugLog('chatgpt', '응답 생성 완료, 안정화 대기');
                await this.sleep(2000);
                return;
            }
            
            await this.sleep(1000);
        }
        
        if (!sawLoading) {
            debugLog('chatgpt', '응답 대기 중 로딩 상태를 감지하지 못함');
            return;
        }
        
        debugLog('chatgpt', 'ChatGPT 응답 대기 시간 초과');
        throw new Error('ChatGPT 응답 대기 시간 초과');
    }

    // 정리 메서드 오버라이드
    destroy() {
        super.destroy();
        
        if (this.chatGPTObserver) {
            this.chatGPTObserver.disconnect();
            this.chatGPTObserver = null;
        }
        
        if (this.urlHandler) {
            this.urlHandler = null;
        }
        
        debugLog('chatgpt', 'ChatGPT 인터페이스 정리 완료');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatGPT 모듈 초기화 및 등록
// ─────────────────────────────────────────────────────────────────────────────

// 전역 스코프에 서비스 모듈 등록
window.aiServiceModule = new ChatGPTInterface();

// 디버그 함수
window.debugChatGPT = function() {
    const module = window.aiServiceModule;
    if (module && module.siteName === 'ChatGPT') {
        console.log('=== ChatGPT Debug Info ===');
        console.log('Service module:', module);
        console.log('UI variants:', module.uiVariants);
        console.log('Connection status:', module.checkConnection());
        console.log('Conversation data:', module.getConversationData());
        console.log('URL:', window.location.href);
        console.log('Extension enabled:', module.extensionEnabled);
        
        try {
            const selectors = module.getSelectors();
            console.log('Available elements:');
            console.log('- Input elements:', module.findElements(selectors.messageInput).length);
            console.log('- Send buttons:', module.findElements(selectors.sendButton).length);
            console.log('- Response containers:', module.findElements(selectors.responseContainer).length);
            console.log('- Conversation turns:', module.findElements(selectors.conversationTurn).length);
        } catch (error) {
            console.log('Element detection error:', error);
        }
        
        // 마크다운 생성 테스트
        try {
            const markdown = module.generateMarkdown(true, true);
            const preview = markdown.length > 200 ? 
                markdown.substring(0, 200) + '...' : markdown;
            console.log('Markdown preview:', preview);
        } catch (error) {
            console.log('Markdown generation error:', error);
        }
    } else {
        console.log('ChatGPT module not loaded or not on ChatGPT page');
    }
};

// 특정 디버그 함수들
window.testChatGPTInput = async function() {
    const module = window.aiServiceModule;
    if (module && module.siteName === 'ChatGPT') {
        const inputEl = module.findElement(module.getSelectors().messageInput);
        if (inputEl) {
            console.log('Testing ChatGPT input...');
            try {
                await module.inputHandler.typeMessageRobust(inputEl, 'Test message from debug function');
                console.log('Input test completed');
            } catch (error) {
                console.log('Input test failed:', error);
            }
        } else {
            console.log('No input element found');
        }
    }
};

window.testChatGPTConnection = async function() {
    const module = window.aiServiceModule;
    if (module && module.siteName === 'ChatGPT') {
        console.log('Testing ChatGPT connection...');
        try {
            const result = await module.testConnection();
            console.log('Connection test result:', result);
        } catch (error) {
            console.log('Connection test error:', error);
        }
    }
};

// URL 변경 감지 (ChatGPT SPA 대응)
let lastChatGPTUrl = location.href;
const chatGPTUrlObserver = new MutationObserver(
    window.UniversalAIAssistant.utils.debounce(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastChatGPTUrl) {
            lastChatGPTUrl = currentUrl;
            debugLog('chatgpt', `ChatGPT URL 변경 감지: ${currentUrl}`);
            
            // URL 핸들러 재실행
            if (window.aiServiceModule && window.aiServiceModule.urlHandler) {
                setTimeout(() => {
                    window.aiServiceModule.urlHandler.checkAndRedirectIfNeeded();
                }, 1000);
            }
        }
    }, 500)
);

chatGPTUrlObserver.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-pathname', 'data-route', 'href']
});

// 정리 함수
window.addEventListener('beforeunload', () => {
    if (chatGPTUrlObserver) {
        chatGPTUrlObserver.disconnect();
    }
});

debugLog('chatgpt', '🚀 ChatGPT 서비스 모듈 로드 완료');

// 초기 디버그 정보 출력 (디버그 모드일 때만)
setTimeout(() => {
    if (window.UniversalAIAssistant?.settings?.debugMode) {
        window.debugChatGPT();
    }
}, 3000);