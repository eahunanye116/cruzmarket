
'use client';

import { useState } from 'react';
import { useStorage, useUser } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Upload, X, Loader2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
}

export function ImageUpload({ value, onChange, folder, label }: ImageUploadProps) {
  const storage = useStorage();
  const user = useUser();
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Default to URL mode if value exists and doesn't look like a Firebase Storage URL, else default to upload
  const [mode, setMode] = useState<'upload' | 'url'>(
    (value && typeof value === 'string' && !value.includes('firebasestorage')) ? 'url' : 'upload'
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !user) return;

    if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Max size is 5MB.");
        return;
    }

    setIsUploading(true);
    const storageRef = ref(storage, `${folder}/${user.uid}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      }, 
      (error) => {
        console.error("Upload failed", error);
        setIsUploading(false);
        alert("Upload failed. Check your Firebase Storage rules.");
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        onChange(downloadURL);
        setIsUploading(false);
        setProgress(0);
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
            <Button 
                type="button" 
                variant={mode === 'upload' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 text-[10px] px-2 font-bold uppercase tracking-wider"
                onClick={() => setMode('upload')}
            >
                <Upload className="h-3 w-3 mr-1" /> File
            </Button>
            <Button 
                type="button" 
                variant={mode === 'url' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-7 text-[10px] px-2 font-bold uppercase tracking-wider"
                onClick={() => setMode('url')}
            >
                <LinkIcon className="h-3 w-3 mr-1" /> URL
            </Button>
        </div>
      </div>

      {value && mode === 'upload' ? (
        <div className="relative w-full aspect-video rounded-md overflow-hidden border-2 bg-muted/20">
          <img src={value} alt="Preview" className="w-full h-full object-contain" />
          <Button 
            type="button" 
            variant="destructive" 
            size="icon" 
            className="absolute top-2 right-2 h-8 w-8 rounded-full border-2 border-background"
            onClick={() => onChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : mode === 'upload' ? (
        <div className="border-2 border-dashed rounded-md p-8 flex flex-col items-center justify-center bg-muted/10 transition-colors hover:bg-muted/20 border-muted">
          <Input 
            type="file" 
            accept="image/*" 
            onChange={handleUpload} 
            className="hidden" 
            id={`file-upload-${label}-${folder.replace(/\//g, '-')}`}
            disabled={isUploading}
          />
          <label 
            htmlFor={`file-upload-${label}-${folder.replace(/\//g, '-')}`} 
            className="cursor-pointer flex flex-col items-center gap-3 w-full"
          >
            {isUploading ? (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            )}
            <div className="text-center">
                <span className="text-sm font-bold block">
                {isUploading ? 'Uploading...' : `Upload ${label || 'Image'}`}
                </span>
                <span className="text-[10px] text-muted-foreground">Tap to select PNG or JPG</span>
            </div>
          </label>
          {isUploading && (
            <div className="w-full mt-4 space-y-1">
                <Progress value={progress} className="h-1.5" />
                <p className="text-[10px] text-center text-muted-foreground font-mono">{Math.round(progress)}%</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
            <Input 
                placeholder={`Paste ${label?.toLowerCase() || 'image'} URL here...`} 
                value={value ?? ''} 
                onChange={(e) => onChange(e.target.value)} 
            />
            <p className="text-[10px] text-muted-foreground italic pl-1">Link to an external image directly.</p>
        </div>
      )}
    </div>
  );
}
