import { useEffect, useRef } from "react";
import { broadcastService } from "../services/broadcastChannelService";

export function usePreviewSync(bundle: string) {
    const previewWindoeRef = useRef<Window | null>(null);
    console.log("bundle in usePreviewSync", { bundle })

    useEffect(() => {
        if(!bundle) return;
        broadcastService.sendBundle(bundle);
    }, [bundle])

    const openPreview = () => {
        if(!previewWindoeRef.current || previewWindoeRef.current.closed) {
            previewWindoeRef.current = window.open("/preview", "code-preview");
        } else {
            previewWindoeRef.current.focus();
        }
    }

    return { openPreview };
}