import { Header } from './components/Header';
import { PortfolioGrid } from './components/portfolio-grid/PortfolioGrid';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// import { SushiSwapComponent } from './components/SushiSwap';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <Header />
      <PortfolioGrid />
      {/* <h3>Testing Sushi Swap</h3>
      <SushiSwapComponent /> */}
    </main>
  );
}