import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, ShieldCheck, ShieldOff, Crown, Search, UserPlus } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import {
  AdminPageHeader,
  AdminSummary,
  AdminSummaryStat,
  AdminEmptyState,
  AdminPageLoader,
  AdminRowActions,
} from '@/components/admin/AdminPage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import {
  AdminRoleRecord,
  grantAdmin,
  listAdmins,
  revokeAdmin,
  roleLabel,
} from '@/services/adminRoles'

/**
 * Painel "Administradores" — visível SOMENTE para o admin principal (dono).
 *
 * O dono concede o cargo de administrador (secundário) a um usuário existente
 * e revoga depois. O backend (pb_hook admin_roles.js) protege as duas ações:
 * só is_owner executa, e o dono nunca é alterado.
 */

const PAGE_SIZE = 25

interface Candidate {
  id: string
  name: string
  email: string
  role: string
}

const pageLoader = <AdminPageLoader label="Carregando administradores..." />

export const AdminRoles: React.FC = () => {
  const { toast } = useToast()
  const [admins, setAdmins] = useState<AdminRoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<AdminRoleRecord | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Busca de candidatos: usuários que ainda não são admins.
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [grantTarget, setGrantTarget] = useState<Candidate | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await listAdmins()
      setAdmins(res.admins)
    } catch (err) {
      toast({
        title: 'Falha ao carregar administradores',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  // Atualiza em tempo real quando qualquer usuário muda (promoção/revogação
  // feita em outra aba, por exemplo).
  useRealtime(
    'users',
    useCallback(() => {
      load()
    }, [load]),
  )

  const searchCandidates = useCallback(async (q: string) => {
    setSearching(true)
    try {
      const filter = q
        ? `(name ~ "${q.replace(/"/g, '')}" || email ~ "${q.replace(/"/g, '')}")`
        : ''
      const res = await pb.collection('users').getList<Candidate>(1, PAGE_SIZE, {
        filter,
        sort: 'name',
      })
      // Só quem ainda NÃO é admin (o cargo do secundário é 'admin' sem is_owner).
      setCandidates(res.items.filter((u) => u.role !== 'admin'))
    } catch {
      setCandidates([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!dialogOpen) return
    const t = setTimeout(() => searchCandidates(query.trim()), 300)
    return () => clearTimeout(t)
  }, [dialogOpen, query, searchCandidates])

  const owner = useMemo(() => admins.find((a) => a.is_owner), [admins])
  const secundarios = useMemo(() => admins.filter((a) => !a.is_owner), [admins])

  const handleGrant = async (c: Candidate) => {
    setBusyId(c.id)
    try {
      await grantAdmin(c.id)
      toast({
        title: 'Cargo concedido',
        description: `${c.name} agora é administrador(a) secundário(a).`,
      })
      setGrantTarget(null)
      setDialogOpen(false)
      setQuery('')
      await load()
    } catch (err) {
      toast({
        title: 'Não foi possível conceder o cargo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleRevoke = async (a: AdminRoleRecord) => {
    setBusyId(a.id)
    try {
      await revokeAdmin(a.id)
      toast({
        title: 'Cargo revogado',
        description: `${a.name} voltou a ser aluno(a).`,
      })
      setRevokeTarget(null)
      await load()
    } catch (err) {
      toast({
        title: 'Não foi possível revogar o cargo',
        description: getErrorMessage(err),
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const stats: AdminSummaryStat[] = [
    {
      value: admins.length,
      label: 'Administradores',
      tone: 'ink',
      icon: <ShieldCheck className="w-5 h-5" />,
    },
    {
      value: secundarios.length,
      label: 'Secundários',
      tone: 'red',
      icon: <UserPlus className="w-5 h-5" />,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <AdminPageHeader
        title="Administradores"
        breadcrumb="Administradores"
        breadcrumbTo="/painel/admins"
        icon={<ShieldCheck className="w-7 h-7" />}
        description={
          'Conceda o cargo de administrador a um usuário de confiança: ele acessa todo o painel ' +
          '(alunos, mensalidades, pedidos, produtos, turmas, financeiro e configurações), mas NÃO ' +
          'pode gerenciar administradores. Você pode revogar o cargo quando quiser.'
        }
        action={
          <Button
            onClick={() => {
              setQuery('')
              setDialogOpen(true)
            }}
            className="bg-[#C1272D] hover:bg-[#A01E23] text-white font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Conceder cargo
          </Button>
        }
      />

      {loading ? (
        pageLoader
      ) : (
        <>
          <AdminSummary stats={stats} />

          {/* Dono — nunca pode ser alterado */}
          {owner && (
            <div className="rounded-2xl border border-[#C1272D]/30 bg-[#F7E4E2]/60 p-5 mb-5 flex items-start gap-4">
              <Crown className="w-6 h-6 text-[#C1272D] shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-serif font-bold text-base text-[#1C1B1A] truncate">
                  {owner.name}
                  <Badge className="ml-2 bg-[#C1272D] text-white border-[#C1272D]">
                    Administrador principal
                  </Badge>
                </p>
                <p className="text-xs text-[#6B6560] mt-1 truncate">{owner.email}</p>
                <p className="text-[11px] text-[#8E1519] mt-2 leading-relaxed">
                  Este é o acesso principal da academia: não pode ser rebaixado nem ter o cargo
                  alterado por nenhum outro administrador.
                </p>
              </div>
            </div>
          )}

          {/* Secundários */}
          {secundarios.length === 0 ? (
            <AdminEmptyState
              title="Nenhum administrador secundário"
              description="Conceda o cargo a um usuário de confiança para ajudar na gestão do painel. Ele fará tudo, exceto gerenciar administradores."
              icon={<ShieldCheck className="w-10 h-10" />}
              action={
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="bg-[#C1272D] hover:bg-[#A01E23] text-white font-semibold"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Conceder cargo
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl border border-[#E8E0D5] bg-white overflow-hidden shadow-xs">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAF6F0] text-[10px] uppercase tracking-wider text-[#6B6560] border-b border-[#E8E0D5]">
                    <th className="text-left px-4 py-3 font-bold">Nome</th>
                    <th className="text-left px-4 py-3 font-bold hidden sm:table-cell">E-mail</th>
                    <th className="text-left px-4 py-3 font-bold">Cargo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {secundarios.map((a) => (
                    <tr key={a.id} className="border-b border-[#E8E0D5]/60 last:border-0">
                      <td className="px-4 py-3 font-medium text-[#1C1B1A] truncate max-w-[180px]">
                        {a.name}
                        <span className="block sm:hidden text-[11px] text-[#6B6560] font-normal">
                          {a.email}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#6B6560] hidden sm:table-cell truncate max-w-[220px]">
                        {a.email}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="bg-[#F7E4E2] text-[#8E1519] border-[#C1272D]/30"
                        >
                          {roleLabel(a.role, a.is_owner)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <AdminRowActions>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === a.id}
                            onClick={() => setRevokeTarget(a)}
                            className="text-[#C1272D] border-[#C1272D]/40 hover:bg-[#F7E4E2] text-xs"
                          >
                            {busyId === a.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ShieldOff className="w-3.5 h-3.5 mr-1" />
                            )}
                            Revogar
                          </Button>
                        </AdminRowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Diálogo: conceder cargo a um usuário existente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Conceder cargo de administrador</DialogTitle>
            <DialogDescription>
              Busque um usuário (aluno) existente. Ele passará a acessar todo o painel, exceto a
              gestão de administradores.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A948C]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-[#E8E0D5] divide-y divide-[#E8E0D5]/60">
            {searching ? (
              <div className="p-6 flex items-center justify-center text-[#6B6560]">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="text-xs">Buscando...</span>
              </div>
            ) : candidates.length === 0 ? (
              <p className="p-6 text-xs text-[#6B6560] text-center leading-relaxed">
                {query
                  ? 'Nenhum usuário encontrado com esse nome ou e-mail.'
                  : 'Digite para buscar usuários que ainda não são administradores.'}
              </p>
            ) : (
              candidates.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#FAF6F0] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1C1B1A] truncate">{c.name}</p>
                    <p className="text-[11px] text-[#6B6560] truncate">{c.email}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={busyId === c.id}
                    onClick={() => handleGrant(c)}
                    className="bg-[#C1272D] hover:bg-[#A01E23] text-white text-xs shrink-0"
                  >
                    {busyId === c.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Conceder'
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>

          {grantTarget && (
            <p className="text-[11px] text-[#2E7D4F]">Cargo será concedido a {grantTarget.name}.</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação antes de revogar */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Revogar cargo de administrador?</DialogTitle>
            <DialogDescription>
              {revokeTarget?.name} deixará de acessar o painel e voltará a ser aluno(a) comum. Essa
              ação pode ser desfeita concedendo o cargo novamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={busyId === revokeTarget?.id}
              onClick={() => revokeTarget && handleRevoke(revokeTarget)}
            >
              {busyId === revokeTarget?.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Revogando...
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Revogar cargo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
