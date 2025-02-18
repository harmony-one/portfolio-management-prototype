import { Header } from './components/Header';
import { PortfolioGrid } from './components/portfolio-grid/PortfolioGrid';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Header />
      <PortfolioGrid />
    </main>
  );
}