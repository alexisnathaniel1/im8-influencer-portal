"use client";

interface DriveVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  fileId: string;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
}

export function DriveVideo({ fileId, containerClassName, containerStyle, ...videoProps }: DriveVideoProps) {
  return (
    <div className={containerClassName} style={containerStyle}>
      <video src={`/api/drive/video/${fileId}`} {...videoProps} />
    </div>
  );
}
