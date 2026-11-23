import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { HankoStamp } from '@/components/HankoStamp'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Loader2, User, Mail, Shield, Upload } from 'lucide-react'

export default function Account() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [name, setName] = useState(user?.name || '')
  const [newEmail, setNewEmail] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isRequestingEmailChange, setIsRequestingEmailChange] = useState(false)

  if (!user) {
    navigate('/entrar')
    return null
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      if (avatarFile) {
        formData.append('avatar', avatarFile)
      }

      await pb.collection('users').update(user.id, formData)
      await refreshUser()
      toast({
        title: 'Perfil atualizado!',
        description: 'Seus dados foram salvos com sucesso.',
      })
    } catch (err: any) {
      console.error('Erro ao atualizar perfil:', err)
      toast({
        title: 'Erro ao atualizar perfil',
        description: err?.message || 'Falha ao salvar alterações.',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim() || newEmail.trim() === user.email) {
      toast({
        title: 'Informe um novo e-mail diferente do atual',
        variant: 'destructive',
      })
      return
    }

    setIsRequestingEmailChange(true)
    try {
      await pb.collection('users').requestEmailChange(newEmail.trim())
      toast({
        title: 'Link de confirmação enviado!',
        description: `Enviamos uma mensagem para ${newEmail.trim()}. Acesse o link para confirmar a alteração.`,
      })
      setNewEmail('')
    } catch (err: any) {
      console.error('Erro ao solicitar troca de e-mail:', err)
      toast({
        title: 'Falha na solicitação',
        description: err?.message || 'Verifique o endereço informado.',
        variant: 'destructive',
      })
    } finally {
      setIsRequestingEmailChange(false)
    }
  }

  const avatarUrl = user.avatar ? pb.files.getURL(user as any, user.avatar) : null

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 animate-fade-rise">
      <div className="mb-8">
        <span className="text-xs font-bold text-[#C1272D] tracking-widest uppercase font-serif">
          Configurações Pessoais
        </span>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-[#1C1B1A] mt-1">
          Minha Conta
        </h1>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-6 shadow-xs">
          <h2 className="font-serif font-bold text-base text-[#1C1B1A] mb-4 pb-3 border-b border-[#E8E0D5] flex items-center justify-between">
            <span>Dados do Aluno</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] text-[#C1272D] font-mono font-bold">
              {user.role === 'aluno'
                ? 'Aluno'
                : user.is_owner
                  ? 'Administrador principal'
                  : 'Administrador secundário'}
            </span>
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            {/* Avatar Preview & Upload */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#FAF6F0] border border-[#E8E0D5] flex items-center justify-center font-serif text-[#C1272D] font-bold text-2xl overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{user.name ? user.name[0].toUpperCase() : '柔'}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                  Foto de Perfil (Avatar)
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setAvatarFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs text-[#6B6560] file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#F7E4E2] file:text-[#C1272D] hover:file:bg-[#F7E4E2]/80"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Nome Completo
              </label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <Button
              type="submit"
              disabled={isUpdatingProfile}
              className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs font-semibold"
            >
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </form>
        </div>

        {/* Change Email Card (2-step flow) */}
        <div className="bg-white rounded-2xl border border-[#E8E0D5] p-6 shadow-xs">
          <h2 className="font-serif font-bold text-base text-[#1C1B1A] mb-2 pb-3 border-b border-[#E8E0D5]">
            Alterar Endereço de E-mail
          </h2>
          <p className="text-xs text-[#6B6560] mb-4">
            E-mail atual cadastrado: <strong>{user.email}</strong>. Para alterar, informe o novo
            e-mail abaixo e confirme através do link que enviaremos.
          </p>

          <form onSubmit={handleRequestEmailChange} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1C1B1A] uppercase tracking-wider mb-1 font-serif">
                Novo E-mail
              </label>
              <Input
                type="email"
                placeholder="novo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="outline"
              disabled={isRequestingEmailChange}
              className="border-[#1C1B1A] text-xs font-semibold"
            >
              {isRequestingEmailChange ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  Enviando confirmação...
                </>
              ) : (
                'Solicitar Troca de E-mail'
              )}
            </Button>
          </form>
        </div>

        {/* Danger zone / Logout */}
        <div className="pt-4 flex justify-between items-center text-xs">
          <span className="text-[#6B6560]">Deseja encerrar a sessão neste navegador?</span>
          <Button
            variant="ghost"
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="text-[#B3261E] hover:bg-[#F7E4E2] text-xs"
          >
            Sair da Conta
          </Button>
        </div>
      </div>
    </div>
  )
}
