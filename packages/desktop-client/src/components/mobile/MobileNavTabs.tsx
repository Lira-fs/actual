import React, { useCallback, useState } from 'react';
import type { ComponentProps, ComponentType, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { animated, config, useSpring } from 'react-spring';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import {
  SvgAdd,
  SvgCog,
  SvgCreditCard,
  SvgDotsHorizontalTriple,
  SvgHome,
  SvgList,
  SvgPiggyBank,
  SvgReports,
  SvgStoreFront,
  SvgTuning,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { useDrag } from '@use-gesture/react';

import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useScrollListener } from '#hooks/useScrollListener';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

const COLUMN_COUNT = 5;
const ROW_COUNT = 3;
const PILL_HEIGHT = 15;
const ROW_HEIGHT = 70;
const TOTAL_HEIGHT = ROW_HEIGHT * ROW_COUNT;
const OPEN_FULL_Y = 1;
const OPEN_DEFAULT_Y = TOTAL_HEIGHT - ROW_HEIGHT;
const HIDDEN_Y = TOTAL_HEIGHT;

export const MOBILE_NAV_HEIGHT = ROW_HEIGHT + PILL_HEIGHT;

export function MobileNavTabs() {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();
  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;
  const [navbarState, setNavbarState] = useState<'default' | 'open' | 'hidden'>(
    'default',
  );

  const navTabStyle = {
    flex: `1 1 ${100 / COLUMN_COUNT}%`,
    height: ROW_HEIGHT,
    padding: '10px 2px',
    maxWidth: `${100 / COLUMN_COUNT}%`,
    fontSize: 11,
  };

  const [{ y }, api] = useSpring(() => ({ from: { y: OPEN_DEFAULT_Y } }), []);

  const openFull = useCallback(
    ({ canceled }: { canceled?: boolean }) => {
      // when cancel is true, it means that the user passed the upwards threshold
      // so we change the spring config to create a nice wobbly effect
      setNavbarState('open');
      void api.start({
        to: { y: OPEN_FULL_Y },
        immediate: isTestEnv,
        config: canceled ? config.wobbly : config.stiff,
      });
    },
    [api, isTestEnv],
  );

  const openDefault = useCallback(
    (velocity = 0) => {
      setNavbarState('default');
      void api.start({
        to: { y: OPEN_DEFAULT_Y },
        immediate: isTestEnv,
        config: { ...config.stiff, velocity },
      });
    },
    [api, isTestEnv],
  );

  const hide = useCallback(
    (velocity = 0) => {
      setNavbarState('hidden');
      void api.start({
        to: { y: HIDDEN_Y },
        immediate: isTestEnv,
        config: { ...config.stiff, velocity },
      });
    },
    [api, isTestEnv],
  );

  // Linha principal (estilo Mobills): Início · Transações · [+] · Orçamento · Mais
  // Demais abas ficam nas linhas ocultas, acessíveis pelo "Mais" ou arrastando.
  const primaryTabs = [
    {
      name: t('Home'),
      path: '/home',
      style: navTabStyle,
      Icon: SvgHome,
    },
    {
      name: t('Transactions'),
      path: '/accounts/all',
      style: navTabStyle,
      Icon: SvgList,
    },
  ].map(tab => (
    <NavTab key={tab.path} onClick={() => openDefault()} {...tab} />
  ));

  const budgetTab = (
    <NavTab
      key="/budget"
      name={t('Budget')}
      path="/budget"
      style={navTabStyle}
      Icon={SvgWallet}
      onClick={() => openDefault()}
    />
  );

  const hiddenTabs = [
    {
      name: t('Accounts'),
      path: '/accounts',
      style: navTabStyle,
      Icon: SvgPiggyBank,
    },
    {
      name: t('Reports'),
      path: '/reports',
      style: navTabStyle,
      Icon: SvgReports,
    },
    {
      name: t('Schedules'),
      path: '/schedules',
      style: navTabStyle,
      Icon: SvgCalendar3,
    },
    {
      name: t('Payees'),
      path: '/payees',
      style: navTabStyle,
      Icon: SvgStoreFront,
    },
    {
      name: t('Rules'),
      path: '/rules',
      style: navTabStyle,
      Icon: SvgTuning,
    },
    ...(isUsingServer
      ? [
          {
            name: t('Bank Sync'),
            path: '/bank-sync',
            style: navTabStyle,
            Icon: SvgCreditCard,
          },
        ]
      : []),
    {
      name: t('Settings'),
      path: '/settings',
      style: navTabStyle,
      Icon: SvgCog,
    },
  ].map(tab => (
    <NavTab key={tab.path} onClick={() => openDefault()} {...tab} />
  ));

  const navTabs = [
    ...primaryTabs,
    <AddTab
      key="/transactions/new"
      label={t('Add transaction')}
      style={navTabStyle}
      onClick={() => openDefault()}
    />,
    budgetTab,
    <MoreTab
      key="more"
      name={t('More')}
      style={navTabStyle}
      isOpen={navbarState === 'open'}
      onPress={() =>
        navbarState === 'open' ? openDefault() : openFull({})
      }
    />,
    ...hiddenTabs,
  ];

  const bufferTabsCount = COLUMN_COUNT - (navTabs.length % COLUMN_COUNT);
  const bufferTabs = Array.from({ length: bufferTabsCount }).map((_, idx) => (
    <div key={idx} style={navTabStyle} />
  ));

  useScrollListener(
    useCallback(
      ({ isScrolling, hasScrolledToEnd }) => {
        if (isScrolling('down') && !hasScrolledToEnd('up')) {
          hide();
        } else if (isScrolling('up') && !hasScrolledToEnd('down')) {
          openDefault();
        }
      },
      [hide, openDefault],
    ),
  );

  const bind = useDrag(
    ({
      last,
      velocity: [, vy],
      direction: [, dy],
      offset: [, oy],
      cancel,
      canceled,
    }) => {
      // if the user drags up passed a threshold, then we cancel
      // the drag so that the sheet resets to its open position
      if (oy < 0) {
        cancel();
      }

      // when the user releases the sheet, we check whether it passed
      // the threshold for it to close, or if we reset it to its open position
      if (last) {
        if (oy > ROW_HEIGHT * 0.5 || (vy > 0.5 && dy > 0)) {
          openDefault(vy);
        } else {
          openFull({ canceled });
        }
      } else {
        // when the user keeps dragging, we just move the sheet according to
        // the cursor position
        void api.start({ to: { y: oy }, immediate: true });
      }
    },
    {
      from: () => [0, y.get()],
      filterTaps: true,
      bounds: { top: -TOTAL_HEIGHT, bottom: TOTAL_HEIGHT - ROW_HEIGHT },
      axis: 'y',
      rubberband: true,
    },
  );

  return (
    <animated.div
      role="navigation"
      {...bind()}
      style={{
        y,
        touchAction: 'pan-x',
        backgroundColor: theme.mobileNavBackground,
        borderTop: `1px solid ${theme.menuBorder}`,
        ...styles.shadow,
        height: TOTAL_HEIGHT + PILL_HEIGHT,
        width: '100%',
        position: 'fixed',
        zIndex: 100,
        bottom: 0,
        ...(!isNarrowWidth && { display: 'none' }),
      }}
      data-navbar-state={navbarState}
    >
      <View>
        <div
          style={{
            backgroundColor: theme.pillBorder,
            borderRadius: 10,
            width: 30,
            marginTop: 5,
            marginBottom: 5,
            padding: 2,
            alignSelf: 'center',
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            height: TOTAL_HEIGHT,
            width: '100%',
          }}
        >
          {[navTabs, bufferTabs]}
        </View>
      </View>
    </animated.div>
  );
}

type NavTabIconProps = {
  width: number;
  height: number;
  style?: CSSProperties;
};

type NavTabProps = {
  name: string;
  path: string;
  Icon: ComponentType<NavTabIconProps>;
  style?: CSSProperties;
  onClick: ComponentProps<typeof NavLink>['onClick'];
};

function NavTab({ Icon: TabIcon, name, path, style, onClick }: NavTabProps) {
  return (
    <NavLink
      to={path}
      style={({ isActive }) => ({
        ...styles.noTapHighlight,
        alignItems: 'center',
        color: isActive ? theme.mobileNavItemSelected : theme.mobileNavItem,
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        textAlign: 'center',
        textWrap: 'balance',
        userSelect: 'none',
        ...style,
      })}
      onClick={onClick}
    >
      <TabIcon width={22} height={22} style={{ minHeight: '22px' }} />
      {name}
    </NavLink>
  );
}

type AddTabProps = {
  label: string;
  style?: CSSProperties;
  onClick: ComponentProps<typeof NavLink>['onClick'];
};

// Botão central destacado (estilo Mobills) para lançar nova transação.
function AddTab({ label, style, onClick }: AddTabProps) {
  return (
    <NavLink
      to="/transactions/new"
      aria-label={label}
      onClick={onClick}
      style={{
        ...styles.noTapHighlight,
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        textDecoration: 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          marginTop: -18,
          backgroundColor: theme.mobileNavItemSelected,
          color: theme.mobileHeaderText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)',
        }}
      >
        <SvgAdd width={24} height={24} />
      </div>
    </NavLink>
  );
}

type MoreTabProps = {
  name: string;
  style?: CSSProperties;
  isOpen: boolean;
  onPress: () => void;
};

// Abre/fecha a gaveta com as demais abas (Contas, Relatórios, etc.).
function MoreTab({ name, style, isOpen, onPress }: MoreTabProps) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onPress}
      style={{
        ...styles.noTapHighlight,
        alignItems: 'center',
        background: 'none',
        border: 'none',
        color: isOpen ? theme.mobileNavItemSelected : theme.mobileNavItem,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'inherit',
        textAlign: 'center',
        userSelect: 'none',
        ...style,
      }}
    >
      <SvgDotsHorizontalTriple
        width={22}
        height={22}
        style={{ minHeight: '22px' }}
      />
      {name}
    </button>
  );
}
