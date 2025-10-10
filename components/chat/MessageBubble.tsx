import { cn } from "@/lib/utils";


export default function MessageBubble({ role, children, evalLine }:{
    role: "interviewer" | "candidate";
    children: React.ReactNode;
    evalLine?: React.ReactNode;
}) {
    const isAI = role === "interviewer";
    return (
        <div className={cn(
            "max-w-[80%] rounded-2xl px-4 py-3 shadow",
            isAI ? "bg-zinc-900/60 border border-zinc-800" : "bg-zinc-800 border border-zinc-700 ml-auto"
        )}>
            <div className="mb-1 text-xs text-zinc-400" aria-label={isAI ? "Interviewer message" : "Your message"}>{isAI ? "AI" : "You"}</div>
            <div className="leading-relaxed whitespace-pre-wrap">{children}</div>
            {evalLine && <div className="mt-2 text-xs text-zinc-400 border-t border-zinc-800 pt-2">{evalLine}</div>}
        </div>
    );
}