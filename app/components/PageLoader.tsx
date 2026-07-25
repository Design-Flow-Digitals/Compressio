import { useNavigation } from "react-router";
import styles from "../styles/loader.module.css";

export function PageLoader() {
  const navigation = useNavigation();
  
  // Show loader when navigating between routes, but ignore simple form submissions if desired.
  // For global loading, we can just check if state is "loading".
  const isLoading = navigation.state === "loading";

  if (!isLoading) return null;

  return (
    <div className={styles.loaderOverlay}>
      <div className={styles.loaderContainer}>
        <div className={styles.spinnerRing}>
          <div className={styles.spinnerInner}></div>
          <img 
            src="/compressio_logo_v1.png" 
            alt="Compressio Loading" 
            className={styles.logo} 
          />
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill}></div>
        </div>
      </div>
    </div>
  );
}
