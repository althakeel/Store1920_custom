"use client";
import ReduxProvider from "@/lib/ReduxProvider";
import Navbar from "@/components/Navbar";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import GoogleOneTapLoader from "@/components/GoogleOneTapLoader";
import SupportBar from "@/components/SupportBar";
import SpinWheelWidget from "@/components/SpinWheelWidget";
import GiveawayCartManager from "@/components/GiveawayCartManager";
import DynamicMetaTags from "@/components/DynamicMetaTags";
import { Toaster } from "react-hot-toast";

export default function ClientLayout({ children }) {
  return (
    <ReduxProvider>
      <TopBar />
      <Navbar />
      <Toaster />
      <DynamicMetaTags />
      <GoogleOneTapLoader />
      <GiveawayCartManager />
      {children}
      <SpinWheelWidget />
      <SupportBar />
      <Footer />
    </ReduxProvider>
  );
}
