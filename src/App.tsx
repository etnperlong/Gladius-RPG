import { useEffect } from "react";

import LegacyGame from "./legacy/game";

export default function App() {
  useEffect(() => {
    const loading = document.getElementById("loading");

    if (loading) {
      loading.style.display = "none";
    }
  }, []);

  return <LegacyGame />;
}
