import { User } from 'lucide-react';

interface AudioAvatarProps {
  avatarUrl?: string;
}

export default function AudioAvatar({ avatarUrl }: AudioAvatarProps) {
  return (
    <div className="flex-shrink-0 w-11 h-11 rounded-full overflow-hidden bg-whatsapp-muted/20 flex items-center justify-center">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <User className="h-5 w-5 text-whatsapp-muted" />
      )}
    </div>
  );
}
