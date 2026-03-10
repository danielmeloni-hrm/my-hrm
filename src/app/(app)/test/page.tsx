import SublimeEmbed from "@/components/SublimeEmbed";

export default function Page() {
  return (
    <div style={{ padding: 40 }}>
      <h1>Note Board</h1>

      <SublimeEmbed
        filePath="note_live.js"
        socketUrl="https://sublime-bridge-server.onrender.com"
        language="javascript"
      />
    </div>
  );
}