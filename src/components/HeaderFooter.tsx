import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCart } from '@/context/CartContext'
import { HankoStamp } from '@/components/HankoStamp'
import { BrushDivider } from '@/components/hero/HeroDecor'
import { HomeAnchor } from '@/components/homeAnchors'
import {
  User,
  LogOut,
  ShoppingBag,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  UserCog,
  Users,
  GraduationCap,
  Trophy,
  Calendar,
  Settings,
  Mail,
  Package,
  BarChart3,
  UsersRound,
  ShieldCheck,
  Wallet,
  CalendarCheck,
  Medal,
  FileText,
} from 'lucide-react'
import { useSiteContent } from '@/services/siteSettings'
import { hasArea, ADMIN_AREA_LABELS, AdminArea } from '@/lib/adminAreas'
import { pb } from '@/lib/pocketbase/client'
import { UserRole } from '@/types'
import { AdminRoleBadge } from '@/components/admin/AdminRoleBadge'
