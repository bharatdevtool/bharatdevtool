// Link-preview (Open Graph) image for every tool, generated at build time: /og/<tool-id>.png
// Branding travels with every shared link (WhatsApp, Slack, X), never inside users' files.
import { ImageResponse } from 'next/og';
import { TOOLS, getToolById } from '@/config/tools';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [...TOOLS.map((t) => ({ id: `${t.id}.png` })), { id: 'default.png' }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tool = getToolById(id.replace(/\.png$/, ''));
  const title = tool?.label ?? 'Free developer tools';
  const sub = tool?.shortDesc ?? 'JSON, PDF, images, QR and more';
  const category = tool?.category ?? 'Bharat Dev Tools';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #090E17 0%, #0F172A 60%, #0B2545 100%)', color: '#F8FAFC', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800 }}>BD</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Bharat Dev Tools</div>
          <div style={{ marginLeft: 'auto', padding: '8px 18px', borderRadius: 999, border: '2px solid #334155', color: '#94A3B8', fontSize: 24 }}>{category}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: title.length > 22 ? 76 : 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 36, color: '#CBD5E1', maxWidth: 980 }}>{sub}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 28 }}>
          <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, background: 'rgba(16,185,129,.15)', color: '#34D399', fontWeight: 700 }}>Free · Private · No sign-up</div>
          <div style={{ color: '#94A3B8' }}>Runs in your browser</div>
          <div style={{ marginLeft: 'auto', color: '#60A5FA', fontWeight: 700 }}>bharatdevtool.com</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
