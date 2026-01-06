import { notFound } from 'next/navigation';
import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import type { Metadata } from 'next';

const docMap = {
  terms: {
    title: 'Terms of Service',
    file: 'terms-of-service.md',
    folder: 'policies',
  },
  privacy: {
    title: 'Privacy Policy',
    file: 'privacy-policy.md',
    folder: 'policies',
  },
  'legal-notice': {
    title: 'Legal Notice',
    file: 'legal-notice.md',
    folder: 'policies',
  },
  dpa: {
    title: 'Data Processing Agreement',
    file: 'dpa-template.md',
    folder: 'policies',
  },
} as const;

type LegalSlug = keyof typeof docMap;

async function loadDoc(slug: LegalSlug) {
  const doc = docMap[slug];
  const root = path.resolve(process.cwd(), '..', '..');
  const filePath = path.join(root, 'docs', doc.folder, doc.file);
  const content = await fs.readFile(filePath, 'utf-8');
  return { title: doc.title, content };
}

export async function generateStaticParams() {
  return Object.keys(docMap).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const doc = docMap[params.slug as LegalSlug];
  if (!doc) {
    return {
      title: 'Legal',
    };
  }
  return { title: `${doc.title} • FlowVault` };
}

export default async function LegalPage({ params }: { params: { slug: string } }) {
  const slug = params.slug as LegalSlug;
  if (!docMap[slug]) {
    notFound();
  }

  const { title, content } = await loadDoc(slug);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-6">
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Back to FlowVault
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Markdown source is rendered as plain text. Contact legal@flowvault.dev for PDF copies.
        </p>
        <div className="rounded border border-border bg-card p-6">
          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-foreground">
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}
