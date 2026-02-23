export default function StellarViewerPage() {
  return (
    <div className="h-screen w-full">
      <iframe
        src="/stellar/index.html"
        className="h-full w-full border-0"
        title="Stellar Dodecahedron Viewer"
      />
    </div>
  );
}
