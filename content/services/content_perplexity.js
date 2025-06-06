// ─────────────────────────────────────────────────────────────────────────────
// Universal AI Assistant - Perplexity Service Module (content_perplexity.js)
// Multi-Chat + MD Export 통합 기능 제공
// ─────────────────────────────────────────────────────────────────────────────

// Perplexity 전용 인터페이스 클래스
class PerplexityInterface extends window.UniversalAIAssistant.BaseAISiteInterface {
    constructor() {
        super('Perplexity');
        this.serviceEmoji = '🔍';
        this.lastQueryTime = null;
        this.searchInProgress = false;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 셀렉터 정의 (Multi-Chat + MD Export 통합)
    // ─────────────────────────────────────────────────────────────────────────────

    getSelectors() {
        return {
            // 메시지 입력 관련 (Multi-Chat)
            messageInput: [
                'textarea[placeholder*="Ask anything"]',
                'textarea[data-testid="search-input"]',
                'textarea[placeholder*="질문"]',
                'textarea[placeholder*="Follow up"]',
                'textarea',
                'div[contenteditable="true"]',
                'input[type="text"]',
                '.search-input',
                'form textarea'
            ],
            
            // 전송 버튼 (Multi-Chat)
            sendButton: [
                'button[aria-label*="Submit"]',
                'button[data-testid="submit-button"]',
                'button:has(svg):not([disabled])',
                'button[type="submit"]:not([disabled])',
                'button[aria-label*="Send"]',
                '.submit-button:not([disabled])',
                'button[class*="submit"]:not([disabled])',
                'form button:not([disabled])'
            ],
            
            // 응답 컨테이너 (Multi-Chat)
            responseContainer: [
                '.prose-answer',
                '[data-testid="answer-content"]',
                '.answer-text',
                '.response-container',
                '.markdown-content',
                '.answer-section',
                '[id^="markdown-content-"]',
                '.prose'
            ],
            
            // 로딩 인디케이터 (Multi-Chat)
            loadingIndicator: [
                '.searching',
                '.loading',
                '.spinner',
                '[data-testid="searching"]',
                '.animate-pulse',
                '.generating',
                '[aria-label*="Searching"]'
            ],
            
            // MD Export 전용 셀렉터
            conversationContainer: [
                '.scrollable-container',
                'main',
                '[role="main"]',
                '.main-content'
            ],
            
            questionSections: [
                'div[class*="border-b"]',
                '.question-container',
                'h1.font-display',
                '.whitespace-pre-line.break-words'
            ],
            
            answerSections: [
                '[id^="markdown-content-"]',
                '.prose',
                '[class*="prose"]',
                '.answer-container'
            ],
            
            citationLinks: [
                'a.citation',
                'a[class*="citation"]',
                'a[href^="http"]'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 연결 확인
    // ─────────────────────────────────────────────────────────────────────────────

    async checkConnection() {
        try {
            if (!this.extensionEnabled) {
                return false;
            }

            const inputEl = this.findElement(this.getSelectors().messageInput);
            
            // Perplexity는 로그인 없이도 사용 가능하므로 입력창만 확인
            const isPageReady = !!inputEl && 
                               !document.querySelector('.error-page, .maintenance-page');
            
            debugLog('perplexity', 'Connection check', {
                inputFound: !!inputEl,
                pageReady: isPageReady,
                url: window.location.href
            });
            
            return isPageReady;
        } catch (error) {
            debugLog('perplexity', 'checkConnection 오류:', error);
            return false;
        }
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
            const btn = this.findElement(this.getSelectors().sendButton);
            
            if (!inputEl) {
                return { 
                    success: false, 
                    error: 'Perplexity 검색 입력창을 찾을 수 없습니다' 
                };
            }
            
            inputEl.focus();
            await this.sleep(100);
            
            return {
                success: true,
                message: 'Perplexity 연결 테스트 성공',
                details: {
                    site: this.siteName,
                    inputTag: inputEl.tagName.toLowerCase(),
                    buttonFound: !!btn,
                    url: window.location.href,
                    extensionEnabled: this.extensionEnabled
                }
            };
        } catch (error) {
            debugLog('perplexity', 'testConnection 오류:', error);
            return { success: false, error: error.message };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 메시지 전송
    // ─────────────────────────────────────────────────────────────────────────────

    async sendMessage(message) {
        try {
            if (!this.extensionEnabled) {
                debugLog('perplexity', 'sendMessage 차단: 확장 프로그램이 비활성화됨');
                return { 
                    success: false, 
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName,
                    extensionDisabled: true
                };
            }

            if (this.isSending || this.searchInProgress) {
                debugLog('perplexity', 'sendMessage 호출 중복 방지: 이미 전송 중입니다.');
                return { success: false, error: '검색 대기 중입니다.' };
            }
            
            this.isSending = true;
            this.searchInProgress = true;

            debugLog('perplexity', `Perplexity에 검색 요청 시도: ${message}`);

            // 메시지 입력창 찾기
            const inputEl = this.findElement(this.getSelectors().messageInput);
            if (!inputEl) {
                throw new Error('Perplexity 검색 입력창을 찾을 수 없습니다.');
            }

            // 메시지 타이핑 - Perplexity는 주로 textarea 사용
            await this.inputHandler.typeMessageRobust(inputEl, message);
            await this.sleep(1000); // Perplexity는 조금 더 대기

            // 전송 버튼 찾기 & 클릭
            const sendBtn = this.findElement(this.getSelectors().sendButton);
            if (sendBtn) {
                await this.buttonClicker.clickSendButtonRobust(sendBtn, inputEl);
            } else {
                // 버튼이 없으면 Enter 키로 전송 시도
                inputEl.focus();
                await this.sleep(100);
                inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    bubbles: true,
                    cancelable: true
                }));
            }

            this.lastQueryTime = Date.now();
            
            debugLog('perplexity', `Perplexity에 검색 요청 완료`);
            return { 
                success: true, 
                message: '검색 요청 완료', 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };

        } catch (error) {
            debugLog('perplexity', 'sendMessage 오류:', error);
            return { 
                success: false, 
                error: error.message, 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        } finally {
            this.isSending = false;
            // 검색 상태는 응답이 완료될 때까지 유지
            setTimeout(() => {
                this.searchInProgress = false;
            }, 10000); // 10초 후 자동 해제
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 응답 가져오기
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

            await this.waitForResponse(45000); // Perplexity는 검색 시간이 더 길 수 있음
            
            const elems = this.findElements(this.getSelectors().responseContainer);
            if (elems.length === 0) {
                return { responseText: null };
            }
            
            // Perplexity의 경우 가장 최근 답변을 찾기
            const last = elems[elems.length - 1];
            const text = this.extractAnswerContent(last);
            
            return { 
                responseText: text.trim(), 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        } catch (error) {
            debugLog('perplexity', 'getLatestResponse 오류:', error);
            return { 
                responseText: null, 
                error: error.message, 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 검색 응답 대기 (Perplexity 특화)
    // ─────────────────────────────────────────────────────────────────────────────

    async waitForResponse(timeout = 45000) {
        const startTime = Date.now();
        let sawLoading = false;
        
        while (Date.now() - startTime < timeout) {
            // Perplexity의 검색 및 로딩 상태 확인
            const loadingEl = this.findElement(this.getSelectors().loadingIndicator);
            const searchingEl = document.querySelector('.searching, [data-testid="searching"]');
            const spinnerEl = document.querySelector('.spinner, .animate-pulse');
            
            if (loadingEl || searchingEl || spinnerEl) {
                sawLoading = true;
                debugLog('perplexity', '검색 중...');
            } else if (sawLoading) {
                // 검색 및 생성이 끝났으면 조금 더 대기
                debugLog('perplexity', '검색 완료, 응답 확인 중...');
                await this.sleep(3000);
                this.searchInProgress = false;
                return;
            }
            
            await this.sleep(1000);
        }
        
        this.searchInProgress = false;
        
        if (!sawLoading) {
            return;
        }
        throw new Error('Perplexity 응답 대기 시간 초과');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 대화 데이터 추출
    // ─────────────────────────────────────────────────────────────────────────────

    getConversationData() {
        const title = this.extractTitle();
        const conversationPairs = this.extractConversationPairs();

        return {
            title: title,
            userMessages: conversationPairs.length,
            assistantMessages: conversationPairs.length,
            totalMessages: conversationPairs.length * 2,
            serviceName: this.siteName,
            detectionMethod: 'conversation-structure'
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 대화 쌍 추출 (질문-답변 매칭)
    // ─────────────────────────────────────────────────────────────────────────────

    extractConversationPairs() {
        const conversationPairs = [];
        
        // 전체 대화 컨테이너 찾기
        const conversationContainer = this.findElement(this.getSelectors().conversationContainer) || document.body;
        
        // 각 대화 섹션을 순서대로 찾기
        const conversationSections = conversationContainer.querySelectorAll('div[class*="border-b"]');
        
        if (conversationSections.length === 0) {
            // 대안적인 방법으로 질문과 답변 찾기
            return this.extractConversationPairsFallback();
        }
        
        let currentQuestion = null;
        let currentAnswer = null;
        
        for (const section of conversationSections) {
            const isQuestionSection = this.isQuestionSection(section);
            const isAnswerSection = this.isAnswerSection(section);
            
            if (isQuestionSection) {
                // 이전 질문-답변 쌍이 완성되었다면 저장
                if (currentQuestion && currentAnswer) {
                    conversationPairs.push({
                        question: currentQuestion,
                        answer: currentAnswer
                    });
                }
                
                // 새로운 질문 시작
                currentQuestion = this.extractQuestionText(section);
                currentAnswer = null;
            } else if (isAnswerSection && currentQuestion) {
                // 현재 질문에 대한 답변 추출
                currentAnswer = this.extractAnswerContent(section);
            }
        }
        
        // 마지막 쌍 추가
        if (currentQuestion && currentAnswer) {
            conversationPairs.push({
                question: currentQuestion,
                answer: currentAnswer
            });
        }
        
        return conversationPairs;
    }

    extractConversationPairsFallback() {
        const pairs = [];
        
        // 질문 요소들 찾기
        const questionElements = document.querySelectorAll('h1.font-display, .whitespace-pre-line.break-words');
        
        // 답변 요소들 찾기
        const answerElements = document.querySelectorAll('[id^="markdown-content-"]');
        
        const minLength = Math.min(questionElements.length, answerElements.length);
        
        for (let i = 0; i < minLength; i++) {
            const question = this.extractQuestionText(questionElements[i]);
            const answer = this.extractAnswerContent(answerElements[i]);
            
            if (question && answer) {
                pairs.push({ question, answer });
            }
        }
        
        return pairs;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 질문/답변 섹션 판별
    // ─────────────────────────────────────────────────────────────────────────────

    isQuestionSection(section) {
        // 질문을 나타내는 요소들 확인
        const questionSelectors = [
            'h1.font-display',
            '.whitespace-pre-line.break-words',
            '[class*="text-xl"]',
            '[class*="lg:text-3xl"]'
        ];
        
        for (const selector of questionSelectors) {
            const questionElement = section.querySelector(selector);
            if (questionElement) {
                const text = questionElement.textContent.trim();
                // 질문 텍스트 검증
                if (text && 
                    text.length > 10 && 
                    !text.includes('답변') && 
                    !text.includes('출처') && 
                    !text.includes('관련') &&
                    !text.includes('Universal AI') &&
                    !text.includes('내보낸 날짜')) {
                    return true;
                }
            }
        }
        
        return false;
    }

    isAnswerSection(section) {
        // 답변을 나타내는 요소들 확인
        const answerIndicators = [
            '[id^="markdown-content-"]',
            '.prose',
            '[class*="prose"]',
            '[data-testid*="answer"]'
        ];
        
        for (const selector of answerIndicators) {
            if (section.querySelector(selector)) {
                return true;
            }
        }
        
        return false;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 텍스트 추출
    // ─────────────────────────────────────────────────────────────────────────────

    extractQuestionText(element) {
        if (!element) return null;
        
        const selectors = [
            'h1.font-display',
            '.whitespace-pre-line.break-words',
            '[class*="text-xl"]',
            '[class*="lg:text-3xl"]'
        ];
        
        // element가 컨테이너인 경우
        for (const selector of selectors) {
            const textEl = element.querySelector ? element.querySelector(selector) : null;
            if (textEl) {
                const text = textEl.textContent.trim();
                if (text && text.length > 5) {
                    return text;
                }
            }
        }
        
        // element 자체가 텍스트 요소인 경우
        const text = element.textContent.trim();
        if (text && text.length > 5) {
            return text;
        }
        
        return null;
    }

    extractAnswerContent(element) {
        if (!element) return '';
        
        let answerContent = '';
        
        // 마크다운 컨텐츠 찾기
        const markdownContent = element.querySelector('[id^="markdown-content-"]');
        if (markdownContent) {
            const proseContainer = markdownContent.querySelector('.prose, [class*="prose"]');
            if (proseContainer) {
                answerContent += this.parseMarkdownContent(proseContainer);
            } else {
                answerContent += this.parseMarkdownContent(markdownContent);
            }
        } else if (element.classList.contains('prose') || element.querySelector('.prose')) {
            // 직접 prose 컨테이너인 경우
            const proseEl = element.classList.contains('prose') ? element : element.querySelector('.prose');
            answerContent += this.parseMarkdownContent(proseEl);
        } else {
            // 일반 텍스트 추출
            answerContent += extractTextFromElement(element);
        }
        
        // 출처 정보 추가
        const sources = this.extractSources(element);
        if (sources) {
            answerContent += `\n\n### 출처\n\n${sources}`;
        }
        
        return answerContent.trim();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 마크다운 내용 파싱
    // ─────────────────────────────────────────────────────────────────────────────

    parseMarkdownContent(container) {
        if (!container) return '';
        
        let markdown = '';
        
        // 직접 자식 요소들을 순서대로 처리
        const directChildren = Array.from(container.children);
        
        for (const child of directChildren) {
            const tagName = child.tagName.toLowerCase();
            const text = child.textContent.trim();
            
            if (!text) continue;
            
            switch (tagName) {
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    const level = parseInt(tagName.charAt(1));
                    markdown += `${'#'.repeat(level)} ${text}\n\n`;
                    break;
                    
                case 'p':
                    // 문단 내 인라인 요소 처리
                    markdown += this.processInlineElements(child) + '\n\n';
                    break;
                    
                case 'ul':
                    child.querySelectorAll('li').forEach(li => {
                        const liText = this.processInlineElements(li);
                        if (liText.trim()) {
                            markdown += `- ${liText}\n`;
                        }
                    });
                    markdown += '\n';
                    break;
                    
                case 'ol':
                    child.querySelectorAll('li').forEach((li, index) => {
                        const liText = this.processInlineElements(li);
                        if (liText.trim()) {
                            markdown += `${index + 1}. ${liText}\n`;
                        }
                    });
                    markdown += '\n';
                    break;
                    
                case 'table':
                    const tableMarkdown = extractTableMarkdown(child);
                    if (tableMarkdown) {
                        markdown += `${tableMarkdown}\n\n`;
                    }
                    break;
                    
                case 'pre':
                    const code = child.querySelector('code');
                    if (code) {
                        const language = code.className.match(/language-(\w+)/)?.[1] || '';
                        markdown += `\`\`\`${language}\n${code.textContent}\n\`\`\`\n\n`;
                    } else {
                        markdown += `\`\`\`\n${text}\n\`\`\`\n\n`;
                    }
                    break;
                    
                case 'blockquote':
                    text.split('\n').forEach(line => {
                        if (line.trim()) {
                            markdown += `> ${line.trim()}\n`;
                        }
                    });
                    markdown += '\n';
                    break;
                    
                default:
                    // 알 수 없는 태그는 인라인 처리
                    const processedText = this.processInlineElements(child);
                    if (processedText.trim()) {
                        markdown += `${processedText}\n\n`;
                    }
                    break;
            }
        }
        
        // 처리된 마크다운이 너무 짧으면 원본 텍스트 사용
        if (markdown.trim().length < 50) {
            return extractTextFromElement(container);
        }
        
        return markdown.trim();
    }

    processInlineElements(element) {
        let text = '';
        
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                const nodeText = node.textContent.trim();
                
                switch (tagName) {
                    case 'strong':
                    case 'b':
                        text += `**${nodeText}**`;
                        break;
                    case 'em':
                    case 'i':
                        text += `*${nodeText}*`;
                        break;
                    case 'code':
                        text += `\`${nodeText}\``;
                        break;
                    case 'a':
                        const href = node.getAttribute('href');
                        if (href && !href.startsWith('#')) {
                            text += `[${nodeText}](${href})`;
                        } else {
                            text += nodeText;
                        }
                        break;
                    default:
                        text += nodeText;
                        break;
                }
            }
        }
        
        return text;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 출처 정보 추출
    // ─────────────────────────────────────────────────────────────────────────────

    extractSources(section) {
        const sources = [];
        
        // 인용 링크 찾기 (.citation 클래스)
        const citationLinks = section.querySelectorAll('a.citation, a[class*="citation"]');
        citationLinks.forEach((link, index) => {
            const href = link.getAttribute('href');
            const title = link.getAttribute('aria-label') || 
                         link.textContent.trim() || 
                         `출처 ${index + 1}`;
            
            if (href && !href.startsWith('#')) {
                sources.push(`${index + 1}. [${title}](${href})`);
            }
        });
        
        // 일반 외부 링크도 확인 (citation이 없는 경우)
        if (sources.length === 0) {
            const externalLinks = section.querySelectorAll('a[href^="http"]');
            let linkCount = 0;
            
            externalLinks.forEach((link) => {
                if (linkCount >= 10) return; // 최대 10개만
                
                const href = link.getAttribute('href');
                const title = link.textContent.trim();
                
                // 의미있는 링크만 포함
                if (href && title.length > 5 && title.length < 100 && 
                    !title.includes('Read more') && !title.includes('더보기')) {
                    sources.push(`${linkCount + 1}. [${title}](${href})`);
                    linkCount++;
                }
            });
        }
        
        return sources.length > 0 ? sources.join('\n') : null;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 제목 추출
    // ─────────────────────────────────────────────────────────────────────────────

    extractTitle() {
        const titleSources = [
            // 첫 번째 질문을 제목으로 사용
            () => {
                const firstQuestion = document.querySelector('h1.font-display, .whitespace-pre-line.break-words');
                if (firstQuestion && firstQuestion.textContent.trim()) {
                    const title = firstQuestion.textContent.trim();
                    if (!title.includes('Universal AI') && !title.includes('관련') &&
                        !title.includes('답변') && title.length > 5) {
                        return title.length > 100 ? title.substring(0, 100) + '...' : title;
                    }
                }
            },
            
            // 페이지 제목에서 추출
            () => {
                const pageTitle = document.title;
                if (pageTitle && pageTitle.trim()) {
                    let title = pageTitle.trim();
                    title = title.replace(/Perplexity\s*[-|]?\s*/gi, '')
                                .replace(/\s*[-|]?\s*Perplexity/gi, '')
                                .trim();
                    if (title && title.length > 5) {
                        return title;
                    }
                }
            },
            
            // 메타 태그에서 추출
            () => {
                const metaTitle = document.querySelector('meta[property="og:title"]');
                if (metaTitle) {
                    const title = metaTitle.getAttribute('content');
                    if (title && !title.includes('Perplexity')) {
                        return title;
                    }
                }
            },
            
            // URL 쿼리에서 추출
            () => {
                const searchParams = new URLSearchParams(window.location.search);
                const q = searchParams.get('q');
                if (q) {
                    return decodeURIComponent(q);
                }
            },
            
            // URL 경로에서 추출
            () => {
                const pathname = window.location.pathname;
                if (pathname.includes('/search/')) {
                    const pathParts = pathname.split('/search/')[1];
                    if (pathParts) {
                        return decodeURIComponent(pathParts).replace(/[-_]/g, ' ');
                    }
                }
            }
        ];

        for (const source of titleSources) {
            try {
                const title = source();
                if (title && title.length > 0) {
                    debugLog('perplexity', 'Found title:', title);
                    return title;
                }
            } catch (error) {
                debugLog('perplexity', 'Title extraction error:', error);
            }
        }

        return 'Perplexity 검색';
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 마크다운 생성
    // ─────────────────────────────────────────────────────────────────────────────

    generateMarkdown(includeUser, includeAssistant) {
        let markdown = '';
        
        const conversationPairs = this.extractConversationPairs();
        
        if (conversationPairs.length === 0) {
            // 단일 검색 결과 처리
            return this.generateSingleSearchMarkdown(includeUser, includeAssistant);
        }
        
        conversationPairs.forEach((pair, index) => {
            const questionNumber = conversationPairs.length > 1 ? ` ${index + 1}` : '';
            
            // 질문 추가
            if (includeUser && pair.question) {
                markdown += `## ${this.serviceEmoji} 질문${questionNumber}\n\n${pair.question}\n\n`;
            }
            
            // 답변 추가
            if (includeAssistant && pair.answer) {
                markdown += `## 🤖 ${this.siteName} 답변${questionNumber}\n\n${pair.answer}\n\n`;
                
                // 마지막이 아니면 구분선 추가
                if (index < conversationPairs.length - 1) {
                    markdown += '---\n\n';
                }
            }
        });

        return markdown.trim() || '검색 결과를 추출할 수 없습니다.';
    }

    generateSingleSearchMarkdown(includeUser, includeAssistant) {
        let markdown = '';
        
        // 현재 페이지의 검색어 추출
        const searchQuery = this.extractCurrentSearchQuery();
        
        if (includeUser && searchQuery) {
            markdown += `## ${this.serviceEmoji} 검색 질문\n\n${searchQuery}\n\n`;
        }
        
        if (includeAssistant) {
            // 첫 번째 답변 추출
            const answerElement = document.querySelector('[id^="markdown-content-"]') || 
                                 document.querySelector('.prose') ||
                                 document.querySelector('.answer-text');
            
            if (answerElement) {
                const answerContent = this.extractAnswerContent(answerElement);
                if (answerContent) {
                    markdown += `## 🤖 ${this.siteName} 답변\n\n${answerContent}\n\n`;
                }
            } else {
                markdown += `## 🤖 ${this.siteName} 답변\n\n검색 결과를 추출할 수 없습니다.\n\n`;
            }
        }
        
        return markdown.trim() || '검색 결과를 찾을 수 없습니다.';
    }

    extractCurrentSearchQuery() {
        // URL에서 검색어 추출
        const searchParams = new URLSearchParams(window.location.search);
        let query = searchParams.get('q') || searchParams.get('query');
        
        if (query) {
            return decodeURIComponent(query);
        }
        
        // 페이지의 첫 번째 질문 요소에서 추출
        const questionElement = document.querySelector('h1.font-display, .whitespace-pre-line.break-words');
        if (questionElement) {
            const text = questionElement.textContent.trim();
            if (text && text.length > 5) {
                return text;
            }
        }
        
        // 입력창에서 추출 (최후의 수단)
        const inputElement = this.findElement(this.getSelectors().messageInput);
        if (inputElement && inputElement.value) {
            return inputElement.value.trim();
        }
        
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 초기화 및 이벤트 처리
    // ─────────────────────────────────────────────────────────────────────────────

    initialize() {
        debugLog('perplexity', 'Perplexity module initialized');
        
        // Perplexity 특화 초기화 로직
        this.setupSearchObserver();
        this.detectPageType();
        this.setupKeyboardShortcuts();
    }

    setupSearchObserver() {
        // Perplexity의 검색 결과 로딩을 감지
        const observer = new MutationObserver(debounce(() => {
            const answerSections = document.querySelectorAll('[id^="markdown-content-"]');
            const loadingElements = document.querySelectorAll('.searching, .loading, .animate-pulse');
            
            debugLog('perplexity', 'Content change detected', {
                answerSections: answerSections.length,
                loadingElements: loadingElements.length,
                searchInProgress: this.searchInProgress
            });
            
            // 검색 완료 감지
            if (this.searchInProgress && answerSections.length > 0 && loadingElements.length === 0) {
                debugLog('perplexity', 'Search appears to be completed');
                this.searchInProgress = false;
            }
        }, 1500));

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-testid']
        });

        debugLog('perplexity', 'Search observer setup complete');
    }

    detectPageType() {
        const url = window.location.href;
        const isSearchPage = url.includes('/search') || url.includes('?q=');
        const isHomePage = url === 'https://www.perplexity.ai/' || url === 'https://perplexity.ai/';
        const hasQuestions = document.querySelectorAll('h1.font-display').length > 0;
        const hasAnswers = document.querySelectorAll('[id^="markdown-content-"]').length > 0;
        
        debugLog('perplexity', 'Page type detected', {
            url,
            isSearchPage,
            isHomePage,
            hasQuestions,
            hasAnswers,
            inputElements: document.querySelectorAll('textarea').length
        });
        
        // 페이지 타입에 따른 추가 설정
        if (isHomePage) {
            // 홈페이지에서는 입력창 포커스
            setTimeout(() => {
                const inputEl = this.findElement(this.getSelectors().messageInput);
                if (inputEl) {
                    inputEl.focus();
                }
            }, 1000);
        }
    }

    setupKeyboardShortcuts() {
        // Perplexity 전용 키보드 단축키
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter: 검색 실행
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const inputEl = this.findElement(this.getSelectors().messageInput);
                if (inputEl && inputEl === document.activeElement) {
                    const sendBtn = this.findElement(this.getSelectors().sendButton);
                    if (sendBtn && !sendBtn.disabled) {
                        e.preventDefault();
                        sendBtn.click();
                    }
                }
            }
            
            // Escape: 검색 중단 (가능한 경우)
            if (e.key === 'Escape' && this.searchInProgress) {
                const stopBtn = document.querySelector('[aria-label*="Stop"], .stop-button');
                if (stopBtn) {
                    stopBtn.click();
                    this.searchInProgress = false;
                }
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 연결 상태 확인 (향상된 버전)
    // ─────────────────────────────────────────────────────────────────────────────

    checkForRelevantChanges() {
        // Perplexity 특화 변경 감지
        const relevantSelectors = [
            'textarea[placeholder*="Ask"]',
            '[id^="markdown-content-"]',
            '.searching',
            '.loading',
            'button[type="submit"]',
            'h1.font-display'
        ];

        return relevantSelectors.some(selector => {
            try {
                return document.querySelector(selector) !== null;
            } catch {
                return false;
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 디버그 및 상태 확인 메서드
    // ─────────────────────────────────────────────────────────────────────────────

    getDebugInfo() {
        const inputEl = this.findElement(this.getSelectors().messageInput);
        const sendBtn = this.findElement(this.getSelectors().sendButton);
        
        return {
            serviceName: this.siteName,
            url: window.location.href,
            extensionEnabled: this.extensionEnabled,
            searchInProgress: this.searchInProgress,
            lastQueryTime: this.lastQueryTime,
            elements: {
                inputFound: !!inputEl,
                inputType: inputEl ? inputEl.tagName.toLowerCase() : null,
                inputPlaceholder: inputEl ? inputEl.placeholder : null,
                sendButtonFound: !!sendBtn,
                sendButtonDisabled: sendBtn ? sendBtn.disabled : null
            },
            content: {
                questionsCount: document.querySelectorAll('h1.font-display').length,
                answersCount: document.querySelectorAll('[id^="markdown-content-"]').length,
                citationsCount: document.querySelectorAll('a.citation').length,
                loadingElements: document.querySelectorAll('.searching, .loading').length
            },
            conversationData: this.getConversationData()
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 에러 복구 및 재시도 로직
    // ─────────────────────────────────────────────────────────────────────────────

    async handleError(error, context) {
        debugLog('perplexity', `Error in ${context}:`, error);
        
        // 특정 에러에 대한 복구 시도
        if (error.message.includes('입력창을 찾을 수 없습니다')) {
            // 페이지 리로드 후 재시도
            debugLog('perplexity', 'Attempting to recover from input element not found');
            await this.sleep(2000);
            
            // 페이지의 입력 요소들 재검색
            const allInputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
            debugLog('perplexity', `Found ${allInputs.length} potential input elements after recovery attempt`);
        }
        
        if (error.message.includes('응답 대기 시간 초과')) {
            // 검색 상태 리셋
            this.searchInProgress = false;
            debugLog('perplexity', 'Search timeout detected, resetting search state');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 정리 메서드 (오버라이드)
    // ─────────────────────────────────────────────────────────────────────────────

    destroy() {
        // 검색 상태 정리
        this.searchInProgress = false;
        this.lastQueryTime = null;
        
        // 부모 클래스의 정리 메서드 호출
        super.destroy();
        
        debugLog('perplexity', 'Perplexity interface destroyed');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 안전한 초기화
// ─────────────────────────────────────────────────────────────────────────────

function initializePerplexityInterface() {
    // content_common.js 로드 대기
    const maxWaitTime = 10000; // 10초
    const startTime = Date.now();
    
    function attemptInit() {
        if (Date.now() - startTime > maxWaitTime) {
            console.error('[Universal AI Assistant] Perplexity: content_common.js 로드 시간 초과');
            return;
        }
        
        if (!window.UniversalAIAssistant || !window.UniversalAIAssistant.BaseAISiteInterface) {
            debugLog('perplexity', 'content_common.js 로드 대기 중...');
            setTimeout(attemptInit, 500);
            return;
        }

        // 기존 인터페이스 정리
        if (window.aiServiceModule) {
            debugLog('perplexity', '기존 인터페이스 정리');
            try {
                if (typeof window.aiServiceModule.destroy === 'function') {
                    window.aiServiceModule.destroy();
                }
            } catch (error) {
                debugLog('perplexity', '기존 인터페이스 정리 중 오류:', error);
            }
            window.aiServiceModule = null;
        }

        try {
            debugLog('perplexity', '새 인터페이스 생성 시도');
            window.aiServiceModule = new PerplexityInterface();
            debugLog('perplexity', 'Perplexity 통합 인터페이스 초기화 완료');
        } catch (error) {
            console.error('[Universal AI Assistant] Perplexity 초기화 실패:', error);
            // 재시도
            setTimeout(initializePerplexityInterface, 2000);
        }
    }
    
    attemptInit();
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 상태에 따른 초기화
// ─────────────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePerplexityInterface);
} else {
    // 약간의 지연을 두고 초기화 (content_common.js 로드 시간 확보)
    setTimeout(initializePerplexityInterface, 100);
}

// 추가 안전장치
window.addEventListener('load', () => {
    setTimeout(initializePerplexityInterface, 1000);
});

// URL 변경 감지 (SPA 대응)
let lastURL = location.href;
const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastURL) {
        lastURL = currentUrl;
        debugLog('perplexity', 'URL 변경 감지, 재초기화:', currentUrl);
        
        if (window.aiServiceModule) {
            try {
                if (typeof window.aiServiceModule.destroy === 'function') {
                    window.aiServiceModule.destroy();
                }
            } catch (error) {
                debugLog('perplexity', 'URL 변경 시 정리 오류:', error);
            }
            window.aiServiceModule = null;
        }
        setTimeout(initializePerplexityInterface, 2000);
    }
});

urlObserver.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-pathname', 'data-route']
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.aiServiceModule) {
        try {
            if (typeof window.aiServiceModule.destroy === 'function') {
                window.aiServiceModule.destroy();
            }
        } catch (error) {
            debugLog('perplexity', '언로드 시 정리 오류:', error);
        }
    }
    if (urlObserver) urlObserver.disconnect();
});

// ─────────────────────────────────────────────────────────────────────────────
// Perplexity 전용 디버그 함수
// ─────────────────────────────────────────────────────────────────────────────

window.debugPerplexity = function() {
    if (window.aiServiceModule && window.aiServiceModule.siteName === 'Perplexity') {
        console.log('=== Perplexity Debug ===');
        console.log('Service module:', window.aiServiceModule);
        console.log('Debug info:', window.aiServiceModule.getDebugInfo());
        
        try {
            const markdown = window.aiServiceModule.generateMarkdown(true, true);
            console.log('Generated markdown preview:', markdown.substring(0, 500) + '...');
        } catch (error) {
            console.log('Markdown generation error:', error);
        }
    } else {
        console.log('Perplexity module not loaded or not on Perplexity page');
    }
};

// 전역 디버그 함수에 추가
if (typeof window.debugLog === 'undefined') {
    window.debugLog = function(category, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[Universal AI Assistant] [${timestamp}] [${category.toUpperCase()}] ${message}`;
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    };
}

debugLog('perplexity', 'Perplexity service module loaded successfully');
console.log('🚀 Universal AI Assistant - Perplexity 통합 모듈 로드 완료');