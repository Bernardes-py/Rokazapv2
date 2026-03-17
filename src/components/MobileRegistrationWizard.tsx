import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, CheckCircle, XCircle, MessageSquare, Phone, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  checkRegistrationAvailable,
  requestRegistrationCode,
  confirmRegistrationCode,
  respondCaptcha,
} from '@/services/zapiService';

type Step = 'check' | 'request' | 'captcha' | 'confirm' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MobileRegistrationWizard({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('check');
  const [loading, setLoading] = useState(false);
  const [ddi, setDdi] = useState('55');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('sms');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const reset = () => {
    setStep('check');
    setLoading(false);
    setDdi('55');
    setPhone('');
    setMethod('sms');
    setCaptchaImage('');
    setCaptchaInput('');
    setCode('');
    setErrorMsg('');
  };

  const handleCheck = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await checkRegistrationAvailable(ddi, phone);
      if (result.available) {
        setStep('request');
        toast({ title: 'Número disponível para registro!' });
      } else {
        setErrorMsg('Número não disponível para registro.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao verificar disponibilidade');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCode = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await requestRegistrationCode(ddi, phone, method);

      if (result.banned) {
        setErrorMsg('Este número foi banido do WhatsApp.');
        return;
      }

      if (result.retryAfter || result.smsWaitSeconds) {
        const wait = result.retryAfter || result.smsWaitSeconds;
        setErrorMsg(`Aguarde ${wait} segundos antes de tentar novamente.`);
        return;
      }

      if (result.captcha) {
        setCaptchaImage(result.captcha);
        setStep('captcha');
        return;
      }

      setStep('confirm');
      toast({ title: 'Código enviado! Verifique seu dispositivo.' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao solicitar código');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptcha = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await respondCaptcha(captchaInput);
      if (result.success) {
        setStep('confirm');
        toast({ title: 'Captcha resolvido! Digite o código recebido.' });
      } else {
        setErrorMsg('Captcha incorreto. Tente novamente.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar captcha');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await confirmRegistrationCode(code);
      if (result.success !== false) {
        setStep('done');
        toast({ title: 'Número registrado com sucesso!' });
      } else {
        setErrorMsg(result.error || 'Código inválido. Tente novamente.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao confirmar código');
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ['Verificar', 'Solicitar Código', 'Confirmar'];
  const stepIndex = step === 'check' ? 0 : step === 'request' ? 1 : step === 'captcha' ? 1 : step === 'confirm' ? 2 : 2;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Número Mobile</DialogTitle>
          <DialogDescription>Registre um número de telefone via Z-API</DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${i <= stepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              {i < stepLabels.length - 1 && <div className={`h-px w-6 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Step: Check */}
        {step === 'check' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-20">
                <Label htmlFor="ddi">DDI</Label>
                <Input id="ddi" value={ddi} onChange={(e) => setDdi(e.target.value)} placeholder="55" />
              </div>
              <div className="flex-1">
                <Label htmlFor="phone">Número</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11999998888" />
              </div>
            </div>
            <Button onClick={handleCheck} disabled={loading || !phone} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verificar Disponibilidade
            </Button>
          </div>
        )}

        {/* Step: Request */}
        {step === 'request' && (
          <div className="space-y-4">
            <Label>Método de envio do código</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'sms', label: 'SMS', icon: MessageSquare },
                { value: 'voice', label: 'Voz', icon: Phone },
                { value: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
              ].map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={method === value ? 'default' : 'outline'}
                  onClick={() => setMethod(value)}
                  className="flex flex-col gap-1 h-auto py-3"
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>
            <Button onClick={handleRequestCode} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Código
            </Button>
          </div>
        )}

        {/* Step: Captcha */}
        {step === 'captcha' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Resolva o captcha abaixo para continuar:</p>
            {captchaImage && (
              <div className="flex justify-center">
                <img src={`data:image/png;base64,${captchaImage}`} alt="Captcha" className="rounded border" />
              </div>
            )}
            <Input value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} placeholder="Digite o texto do captcha" />
            <Button onClick={handleCaptcha} disabled={loading || !captchaInput} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Captcha
            </Button>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos recebido:</p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={handleConfirm} disabled={loading || code.length < 6} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Código
            </Button>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-center font-medium">Número registrado com sucesso!</p>
            <Button onClick={() => { reset(); onOpenChange(false); }} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
