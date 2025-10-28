import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Bot, User, Loader2, X, Copy, Check, MessageCircle, Minimize2 } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialOceanic } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
    requestId?: string;
}

interface ApiResponse {
    output?: string;
}

// Generate unique ID for each request
const generateUniqueId = (): string => {
    return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Local storage utilities
const STORAGE_KEYS = {
    CHAT_MESSAGES: 'travela_chat_messages',
    USER_SESSION: 'travela_user_session',
    CHAT_STATE: 'travela_chat_state'
};

const saveToLocalStorage = (key: string, data: any): void => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
};

const getFromLocalStorage = (key: string): any => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error('Failed to get from localStorage:', error);
        return null;
    }
};

// Memoized ChatResponseView component
const ChatResponseView: React.FC<{
    text: string;
    sender: "bot" | 'user';
}> = React.memo(({ text, sender }) => {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<any>(null);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    }, [text]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const formattedText = useMemo(() => {
        return text.replace(
            /(https?:\/\/[^\s]+(\.png|\.jpg|\.jpeg|\.gif))/gi,
            "![]($1)"
        );
    }, [text]);

    const markdownComponents = useMemo(() => ({
        img({ src, alt }: { src?: string; alt?: string }) {
            return (
                <img
                    src={src || ""}
                    alt={alt || "image"}
                    className="max-w-full rounded-lg my-2 border border-gray-300 shadow-sm cursor-pointer hover:opacity-90"
                    loading="lazy"
                    onClick={() => window.open(src, "_blank")}
                />
            );
        },
        code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
                <SyntaxHighlighter
                    style={materialOceanic as { [key: string]: React.CSSProperties }}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                >
                    {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
            ) : (
                <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded" {...props}>
                    {children}
                </code>
            );
        },
    }), []);

    return (
        <div className="relative">
            {sender === "bot" && (
                <button
                    onClick={handleCopy}
                    className="absolute -bottom-6 right-0 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition bg-transparent opacity-0 group-hover:opacity-100"
                    title="Copy message"
                >
                    {copied ? (
                        <Check size={12} className="text-green-500" />
                    ) : (
                        <Copy size={12} className="text-gray-500" />
                    )}
                </button>
            )}
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
            >
                {formattedText}
            </ReactMarkdown>
        </div>
    );
});

ChatResponseView.displayName = 'ChatResponseView';

// Support Chat Widget Component
const SupportChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isMinimized, setIsMinimized] = useState<boolean>(false);
    const [userSessionId] = useState<string>(() => {
        const existing = getFromLocalStorage(STORAGE_KEYS.USER_SESSION);
        return existing || generateUniqueId();
    });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // N8N webhook URL
    const N8N_WEBHOOK_URL: string = 'https://n8n.travela.world/webhook/custom_wa_bot';

    // Check if mobile
    const isMobile = window.innerWidth < 768;

    // Load chat state from localStorage on mount
    useEffect(() => {
        const savedMessages = getFromLocalStorage(STORAGE_KEYS.CHAT_MESSAGES);
        const savedState = getFromLocalStorage(STORAGE_KEYS.CHAT_STATE);

        if (savedMessages && Array.isArray(savedMessages) && savedMessages.length > 0) {
            setMessages(savedMessages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
            })));
        } else {
            // Initial welcome message
            const welcomeMessage: Message = {
                id: Date.now(),
                text: "Hello! I'm your Travela support assistant. How can I help you today?",
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages([welcomeMessage]);
        }

        if (savedState) {
            setIsOpen(savedState.isOpen || false);
            setIsMinimized(savedState.isMinimized || false);
        }

        // Save session ID
        saveToLocalStorage(STORAGE_KEYS.USER_SESSION, userSessionId);
    }, [userSessionId]);

    // Save messages to localStorage whenever they change
    useEffect(() => {
        if (messages.length > 0) {
            saveToLocalStorage(STORAGE_KEYS.CHAT_MESSAGES, messages);
        }
    }, [messages]);

    // Save chat state to localStorage
    useEffect(() => {
        saveToLocalStorage(STORAGE_KEYS.CHAT_STATE, {
            isOpen,
            isMinimized
        });
    }, [isOpen, isMinimized]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const scrollToBottom = useCallback((): void => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const toggleChat = useCallback(() => {
        setIsOpen(prev => !prev);
        setIsMinimized(false);
    }, []);

    const minimizeChat = useCallback(() => {
        setIsMinimized(true);
    }, []);

    const maximizeChat = useCallback(() => {
        setIsMinimized(false);
    }, []);

    const sendMessage = useCallback(async (): Promise<void> => {
        if (!inputMessage.trim() || isLoading) return;

        const requestId = generateUniqueId();
        const userMessage: Message = {
            id: Date.now(),
            text: inputMessage,
            sender: 'user',
            timestamp: new Date(),
            requestId
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: inputMessage,
                    requestId,
                    sessionId: userSessionId,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data: ApiResponse = await response.json();

            const botMessage: Message = {
                id: Date.now() + 1,
                text: data.output || 'Sorry, I could not process your request.',
                sender: 'bot',
                timestamp: new Date(),
                requestId
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                id: Date.now() + 1,
                text: 'Sorry, I encountered an error while processing your request. Please try again.',
                sender: 'bot',
                timestamp: new Date(),
                requestId
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [inputMessage, isLoading, N8N_WEBHOOK_URL, userSessionId]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputMessage(e.target.value);
    }, []);

    const messageComponents = useMemo(() => (
        messages.map((message: Message) => (
            <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} group mb-4`}
            >
                <div
                    className={`flex max-w-[85%] ${
                        message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                    } items-start space-x-3`}
                >
                    <div className="flex-shrink-0">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                                message.sender === 'user'
                                    ? 'bg-gradient-to-r from-pink-500 to-pink-600'
                                    : 'bg-gradient-to-r from-gray-600 to-gray-700'
                            }`}
                        >
                            {message.sender === 'user' ? (
                                <User className="w-5 h-5 text-white" />
                            ) : (
                                <Bot className="w-5 h-5 text-white" />
                            )}
                        </div>
                    </div>
                    <div
                        className={`px-4 py-3 rounded-2xl shadow-sm ${
                            message.sender === 'user'
                                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white mr-3'
                                : 'bg-white text-gray-800 ml-3 border border-gray-100'
                        }`}
                    >
                        <div className="text-sm leading-relaxed">
                            <ChatResponseView sender={message.sender} text={message.text} />
                        </div>
                        <div
                            className={`text-xs mt-2 ${
                                message.sender === 'user'
                                    ? 'text-pink-100'
                                    : 'text-gray-500'
                            }`}
                        >
                            {message.timestamp.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                </div>
            </div>
        ))
    ), [messages]);

    return (
        <>
            {/* Chat Button */}
            {!isOpen && (
                <div className="fixed bottom-6 right-6 z-50">
                    <button
                        onClick={toggleChat}
                        className="group relative bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 hover:from-pink-500 hover:via-pink-600 hover:to-pink-700 text-white rounded-full p-4 shadow-2xl hover:shadow-pink-500/40 transition-all duration-700 ease-in-out transform hover:scale-105 hover:rotate-1 flex items-center space-x-2 overflow-hidden"
                    >
                        {/* Animated background shimmer */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1500 ease-in-out"></div>

                        {/* Pulsing ring */}
                        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-300 to-pink-500 opacity-60 animate-ping"></div>

                        <div className="relative z-10 flex items-center space-x-2">
                            <MessageCircle className="w-6 h-6 drop-shadow-lg text-white/90" />
                            <span className="hidden group-hover:block text-sm whitespace-nowrap pr-2 font-semibold tracking-wide transition-all duration-500 ease-in-out transform group-hover:translate-x-1 text-white/95">
                                💬 Let's Chat!
                            </span>
                        </div>

                        {/* Enhanced notification dot */}
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                        </div>
                    </button>
                </div>
            )}

            {/* Chat Widget */}
            {isOpen && (
                <div
                    className={`fixed z-50 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-gray-200/50 ${
                        isMobile
                            ? 'inset-4 top-8'
                            : isMinimized
                                ? 'bottom-6 right-6 w-80 h-16'
                                : 'bottom-6 right-6 w-96 h-[36rem]'
                    } transition-all duration-500 ease-out flex flex-col overflow-hidden transform hover:shadow-3xl`}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 text-white px-6 py-4 flex items-center justify-between relative overflow-hidden">
                        {/* Animated background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>

                        <div className="flex items-center space-x-3 relative z-10">
                            <div className="w-10 h-10 bg-white/25 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white/40">
                                <Bot className="w-5 h-5 text-white drop-shadow-sm" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base tracking-wide">Travela Support</h3>
                                <p className="text-xs text-white/90 flex items-center">
                                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse shadow-sm"></div>
                                    Online • Ready to help
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 relative z-10">
                            {!isMobile && (
                                <button
                                    onClick={isMinimized ? maximizeChat : minimizeChat}
                                    className="text-black  hover:bg-white/25 p-2 rounded-xl transition-all duration-500 ease-in-out transform  border border-white/20 hover:border-white/40"
                                    title={isMinimized ? "Maximize" : "Minimize"}
                                >
                                    <Minimize2 className="w-4 h-4 drop-shadow-sm" />
                                </button>
                            )}
                            <button
                                onClick={toggleChat}
                                className="text-black  hover:bg-white/25 p-2 rounded-xl transition-all duration-500 ease-in-out transform  backdrop-blur-sm border border-white/20 hover:border-white/40"
                                title="Close chat"
                            >
                                <X className="w-4 h-4 drop-shadow-sm" />
                            </button>
                        </div>
                    </div>

                    {/* Chat Content - Hidden when minimized */}
                    {!isMinimized && (
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-2 bg-gradient-to-b from-gray-50/80 to-white/80 backdrop-blur-sm">
                                {messageComponents}

                                {isLoading && (
                                    <div className="flex justify-start mb-4">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg border border-blue-200">
                                                <Bot className="w-5 h-5 text-white drop-shadow-sm" />
                                            </div>
                                            <div className="bg-white/90 backdrop-blur-sm px-4 py-3 rounded-2xl ml-3 border border-gray-200/50 shadow-lg">
                                                <div className="flex items-center space-x-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                                    <span className="text-sm text-gray-600 font-medium">Thinking...</span>
                                                    <div className="flex space-x-1">
                                                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div>
                                                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                                                        <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="border-t border-gray-200/50 p-6 bg-white/90 backdrop-blur-sm">
                                <div className="flex space-x-3">
                                    <textarea
                                        ref={inputRef}
                                        value={inputMessage}
                                        onChange={handleInputChange}
                                        onKeyDown={handleKeyPress}
                                        placeholder="Type your message..."
                                        rows={1}
                                        className="flex-1 px-4 py-3 border-2 border-gray-200/60 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-400 text-sm transition-all duration-500 ease-in-out hover:border-pink-300 hover:shadow-lg bg-white/80 backdrop-blur-sm placeholder-gray-400"
                                        style={{ maxHeight: '80px' }}
                                        onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height = Math.min(target.scrollHeight, 80) + 'px';
                                        }}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!inputMessage.trim() || isLoading}
                                        className="group px-4 py-3 bg-gradient-to-br from-pink-400 via-pink-500 to-pink-600 hover:from-pink-500 hover:via-pink-600 hover:to-pink-700 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-500/50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-500 ease-in-out flex-shrink-0 shadow-lg hover:shadow-pink-500/40 transform hover:scale-110 hover:rotate-3 disabled:transform-none disabled:hover:scale-100 disabled:hover:rotate-0 overflow-hidden relative"
                                    >
                                        {/* Button shimmer effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"></div>

                                        <div className="relative z-10">
                                            {isLoading ? (
                                                <Loader2 className="w-5 h-5 animate-spin drop-shadow-sm text-white" />
                                            ) : (
                                                <Send className="w-5 h-5 drop-shadow-sm transition-transform duration-300 ease-in-out group-hover:translate-x-1 group-hover:-translate-y-1 text-white" />
                                            )}
                                        </div>
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-3 text-center flex items-center justify-center font-medium">
                                    <span className="mr-2">💡</span>
                                    Press Enter to send, Shift+Enter for new line
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </>
    );
};

export default SupportChatWidget
