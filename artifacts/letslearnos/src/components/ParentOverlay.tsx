import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut, KeyRound, Printer } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { api, clearAdminAuth } from "@/lib/api";
import { useLocation } from "wouter";
import { isMuted, setMuted } from "@/lib/sound";
import { isMusicMuted, setMusicMuted } from "@/lib/music";

type Mode = "pin" | "settings";

export function ParentOverlay() {
  const {
    isParentOverlayOpen,
    closeParentOverlay,
    endSession,
  } = useSession();
  const [mode, setMode] = useState<Mode>("pin");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [soundOff, setSoundOff] = useState(isMuted());
  const [musicOff, setMusicOff] = useState(isMusicMuted());
  const [, navigate] = useLocation();

  const handleClose = () => {
    clearAdminAuth();
    closeParentOverlay();
    setMode("pin");
    setPin("");
    setPinError(false);
    setCurrentPin("");
    setNewPin("");
    setSettingsError("");
    setSettingsMessage("");
  };

  const handleDigit = (d: string) => { if (pin.length < 4) setPin(p => p + d); };
  const handleDelete = () => setPin(p => p.slice(0, -1));

  const handleVerify = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    try {
      const { valid } = await api.verifyPin(pin);
      if (valid) { setPinError(false); setPin(""); setMode("settings"); }
      else { setPinError(true); setPin(""); }
    } catch {
      // API unreachable (server restarting, etc.) — treat like a failed
      // attempt so the parent can retry instead of an unhandled rejection.
      setPinError(true);
      setPin("");
    } finally { setLoading(false); }
  };

  const handleEndSession = async () => {
    handleClose();
    try {
      await endSession();
    } catch {
      /* best-effort: still navigate home even if the end-session call failed */
    }
    navigate("/");
  };

  // Keep the admin token alive so the worksheets page skips its PIN gate.
  const handleOpenWorksheets = () => {
    closeParentOverlay();
    setMode("pin");
    setPin("");
    navigate("/worksheets");
  };

  const handleChangePin = async () => {
    if (currentPin.length !== 4 || newPin.length !== 4) return;
    setLoading(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      await api.changePin(currentPin, newPin);
      setCurrentPin("");
      setNewPin("");
      setSettingsMessage("PIN changed.");
    } catch {
      setSettingsError("PIN change failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isParentOverlayOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 pt-[96px]"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white rounded-4xl w-full max-w-sm max-h-[calc(100vh-112px)] overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-black text-gray-800">
                {mode === "pin" ? "Parent Area" : "Parent Settings"}
              </h2>
              <button onClick={handleClose} className="w-24 h-24 rounded-2xl bg-gray-100 flex items-center justify-center" aria-label="Close">
                <X size={28} />
              </button>
            </div>

            {mode === "pin" ? (
              <>
                <p className="text-lg text-gray-500 mb-4 font-bold">Enter your 4-digit PIN</p>
                <div className="flex gap-3 justify-center mb-4">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`w-14 h-14 rounded-2xl border-4 flex items-center justify-center text-3xl font-black
                      ${pin.length > i ? "border-pokemon-blue bg-pokemon-blue/10 text-pokemon-blue" : "border-gray-200 bg-gray-50"}`}>
                      {pin.length > i ? "●" : ""}
                    </div>
                  ))}
                </div>
                {pinError && <p className="text-center text-red-500 font-bold mb-2">Incorrect PIN</p>}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d, i) => (
                    <button
                      key={i}
                      onClick={() => d === "⌫" ? handleDelete() : d ? handleDigit(d) : undefined}
                      disabled={!d}
                      className={`py-4 rounded-2xl text-2xl font-black min-h-[88px]
                        ${d === "⌫" ? "bg-red-100 text-red-600" : d ? "bg-gray-100 text-gray-800 active:bg-gray-200" : "invisible"}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleVerify}
                  disabled={pin.length !== 4 || loading}
                  className="w-full py-4 rounded-2xl bg-pokemon-blue text-white text-lg font-black disabled:opacity-50 min-h-[88px]"
                >
                  {loading ? "Checking..." : "Unlock"}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                {(settingsError || settingsMessage) && (
                  <p className={`text-center text-base font-black ${settingsError ? "text-red-500" : "text-green-600"}`}>
                    {settingsError || settingsMessage}
                  </p>
                )}
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-base font-bold text-gray-500 mb-3">Audio</p>
                  <p className="text-sm font-semibold text-gray-500 mb-3">
                    When OpenAI narration is enabled by the administrator, the
                    voice is AI-generated. Otherwise LetsLearnOS uses the
                    device&apos;s offline voice.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { const v = !musicOff; setMusicMuted(v); setMusicOff(v); }}
                      className={`flex-1 py-3 rounded-2xl text-base font-black min-h-[88px] ${musicOff ? "bg-gray-200 text-gray-500" : "bg-pokemon-blue text-white"}`}
                    >
                      Music: {musicOff ? "Off" : "On"}
                    </button>
                    <button
                      onClick={() => { const v = !soundOff; setMuted(v); setSoundOff(v); }}
                      className={`flex-1 py-3 rounded-2xl text-base font-black min-h-[88px] ${soundOff ? "bg-gray-200 text-gray-500" : "bg-pokemon-blue text-white"}`}
                    >
                      Sounds: {soundOff ? "Off" : "On"}
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4">
                  <p className="text-base font-bold text-gray-500 mb-3">Change PIN</p>
                  <div className="flex gap-3 mb-3">
                    <input
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      inputMode="numeric"
                      type="password"
                      placeholder="Current"
                      className="min-w-0 flex-1 min-h-[88px] rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg font-black"
                    />
                    <input
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      inputMode="numeric"
                      type="password"
                      placeholder="New"
                      className="min-w-0 flex-1 min-h-[88px] rounded-2xl border-2 border-gray-200 px-4 py-3 text-lg font-black"
                    />
                  </div>
                  <button
                    onClick={handleChangePin}
                    disabled={loading || currentPin.length !== 4 || newPin.length !== 4}
                    className="w-full flex items-center justify-center gap-2 bg-pokemon-blue text-white rounded-2xl py-3 text-base font-black min-h-[88px] disabled:opacity-50"
                  >
                    <KeyRound size={28} />
                    Change PIN
                  </button>
                </div>

                <button
                  onClick={handleOpenWorksheets}
                  className="flex items-center justify-center gap-3 bg-gray-50 text-gray-700 rounded-2xl py-4 text-lg font-black min-h-[88px]"
                >
                  <Printer size={31} />
                  Printable Worksheets
                </button>

                <button
                  onClick={handleEndSession}
                  className="flex items-center justify-center gap-3 bg-red-50 text-red-600 rounded-2xl py-4 text-lg font-black min-h-[88px]"
                >
                  <LogOut size={31} />
                  End Session
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
