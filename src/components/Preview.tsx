import { usePreviewListener } from "../hooks/usePreviewListener";
import PreviewFrame from "../components/PreviewFrame";

export default function PreviewPage() {
  const { bundle } = usePreviewListener();

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <PreviewFrame bundle={bundle} />
    </div>
  );
}
