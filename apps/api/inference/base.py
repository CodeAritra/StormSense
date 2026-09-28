from abc import ABC, abstractmethod
import numpy as np

class Nowcaster(ABC):
    @abstractmethod
    def predict(self, vil: np.ndarray, ir: np.ndarray, lght: np.ndarray) -> dict:
        """
        vil, ir, lght: float32 arrays, shape [13, 128, 128], values 0..1
                       (13 past frames, oldest first, 5 minute step)
        returns {
          "vil":       float32 [12, 128, 128]  values 0..1   (next 12 frames, 5 min step)
          "lightning": float32 [12, 128, 128]  probability 0..1
          "explain":   {"radar": float, "satellite": float, "lightning": float}
          "inference_ms": float
        }
        """
        pass
