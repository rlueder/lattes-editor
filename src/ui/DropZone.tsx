import { useRef, useState } from 'react';

export function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={over ? 'dropzone over' : 'dropzone'}
      onDragLeave={() => setOver(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <p>
        Solte aqui o <code>CV_&lt;id&gt;.zip</code> exportado do Lattes, ou um <code>.xml</code>.
      </p>
      <button className="primary" type="button" onClick={() => input.current?.click()}>
        Escolher arquivo
      </button>
      <input
        ref={input}
        hidden
        accept=".zip,.xml,application/zip,application/xml,text/xml"
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
