import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialOceanic } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react"; // icons


interface ChatResponseViewProps {
    text: string;
    sender:"bot" | 'user'
}

const ChatResponseView: React.FC<ChatResponseViewProps> = ({ text,sender }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // reset after 2s
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

    const formatTextWithImages = (input: string) => {
        return input.replace(
            /(https?:\/\/[^\s]+(\.png|\.jpg|\.jpeg|\.gif))/gi,
            "![]($1)"
        );
    };

    // @ts-ignore
    return (
        <div className="relative  border border-gray-300 rounded-lg p-3 shadow-sm">
            {/* Copy Button */}
            {
                sender === "bot" && (
                    <button
                        onClick={handleCopy}
                        className="absolute  !bg-transparent bottom-[-39px] right-0 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                        title="Copy message"
                    >
                        {copied ? (
                            <Check size={16} className="text-green-500" />
                        ) : (
                            <Copy size={16} className="text-gray-500" />
                        )}
                    </button>
                )
            }


            {/* Render AI Message */}
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    img({ src, alt }) {
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
                    // @ts-ignore
                    code({ inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                            <SyntaxHighlighter
                                // @ts-ignore
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
                }}
            >
                {formatTextWithImages(text)}
            </ReactMarkdown>

        </div>
    );
};

export default ChatResponseView;
