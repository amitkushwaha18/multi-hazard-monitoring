import React, { useState } from 'react';
import axios from 'axios';
import { mlUrl } from '../config';

const CVDamageDetectionPanel = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedImage(URL.createObjectURL(file));
    setIsAnalyzing(true);
    setDetectionResult(null);
    setErrorMsg(null);

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await axios.post(mlUrl('/api/ml/cnn/analyze'), form, { timeout: 90000 });
      const d = res.data;
      setDetectionResult({
        structuralIntegrity: `${d?.structuralIntegrity ?? 0}%`,
        damageClass: d?.damageClass || '—',
        confidenceScore: `${d?.detectionConfidence ?? 0}%`,
        impactedAreaSqM: d?.floodSubmersion !== undefined
          ? `${(d.floodSubmersion).toFixed(1)}% submerged`
          : '—'
      });
    } catch (err) {
      setErrorMsg(`Analysis failed: ${err?.message || 'ML service unreachable'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      marginTop: '20px'
    }}>
      <div className="mh-flex-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#ec4899', display: 'flex', alignItems: 'center', gap: '8px' }}>
          👁️ Computer Vision Damage Detection
        </h2>
        <span style={{ fontSize: '12px', background: '#be185d', color: '#fce7f3', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          YOLOv8 Aerial Model
        </span>
      </div>

      <div style={{ background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b' }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageUpload} 
          style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }} 
        />

        {isAnalyzing && (
          <p style={{ color: '#38bdf8', fontSize: '14px', fontWeight: 'bold' }}>
            ⏳ Processing Aerial/Satellite Image through AI Model...
          </p>
        )}

        {errorMsg && (
          <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: 'bold' }}>
            ⚠️ {errorMsg}
          </p>
        )}

        {selectedImage && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <img 
              src={selectedImage} 
              alt="Disaster Scene" 
              style={{ width: '180px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #334155' }} 
            />
            {detectionResult && (
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#f43f5e' }}>
                  <b>Status:</b> {detectionResult.damageClass}
                </p>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#cbd5e1' }}>
                  <b>Structural Integrity:</b> {detectionResult.structuralIntegrity}
                </p>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#cbd5e1' }}>
                  <b>Impacted Zone:</b> {detectionResult.impactedAreaSqM}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#38bdf8' }}>
                  <b>Confidence:</b> {detectionResult.confidenceScore}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CVDamageDetectionPanel;