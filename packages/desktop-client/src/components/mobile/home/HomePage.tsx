import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgAdd } from '@actual-app/components/icons/v1';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { TextOneLine } from '@actual-app/components/text-one-line';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';
import { Cell, Pie, PieChart } from 'recharts';

import { MOBILE_NAV_HEIGHT } from '#components/mobile/MobileNavTabs';
import { PullToRefresh } from '#components/mobile/PullToRefresh';
import { MobilePageHeader, Page } from '#components/Page';
import { CellValue, CellValueText } from '#components/spreadsheet/CellValue';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
import { aqlQuery } from '#queries/aqlQuery';
import * as bindings from '#spreadsheet/bindings';

const CHART_COLORS = [
  '#3d5afe',
  '#00c48c',
  '#ff4757',
  '#ffa726',
  '#ab47bc',
  '#26c6da',
  '#8d6e63',
  '#ec407a',
];

type CategorySlice = {
  name: string;
  amount: number;
};

type RecentTransaction = {
  id: string;
  date: string;
  amount: number;
  payee: string | null;
  category: string | null;
  account: string | null;
};

function monthFilter(month: string) {
  return {
    date: { $transform: '$month', $eq: month },
    'account.offbudget': false,
    'account.closed': false,
    'payee.transfer_acct': null,
  } as const;
}

function useHomeData() {
  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [slices, setSlices] = useState<CategorySlice[]>([]);
  const [recent, setRecent] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const month = monthUtils.currentMonth();

    const [incomeRes, expensesRes, byCategoryRes, recentRes] =
      await Promise.all([
        aqlQuery(
          q('transactions')
            .filter({ ...monthFilter(month), amount: { $gt: 0 } })
            .calculate({ $sum: '$amount' }),
        ),
        aqlQuery(
          q('transactions')
            .filter({ ...monthFilter(month), amount: { $lt: 0 } })
            .calculate({ $sum: '$amount' }),
        ),
        aqlQuery(
          q('transactions')
            .filter({
              ...monthFilter(month),
              amount: { $lt: 0 },
              'category.is_income': false,
            })
            .groupBy(['category.name'])
            .select([
              { category: 'category.name' },
              { amount: { $sum: '$amount' } },
            ]),
        ),
        aqlQuery(
          q('transactions')
            .options({ splits: 'inline' })
            .orderBy({ date: 'desc' })
            .limit(5)
            .select([
              'id',
              'date',
              'amount',
              { payee: 'payee.name' },
              { category: 'category.name' },
              { account: 'account.name' },
            ]),
        ),
      ]);

    setIncome(incomeRes.data ?? 0);
    setExpenses(Math.abs(expensesRes.data ?? 0));
    setSlices(
      (byCategoryRes.data ?? [])
        .map((row: { category: string | null; amount: number }) => ({
          name: row.category,
          amount: Math.abs(row.amount),
        }))
        .sort((a: CategorySlice, b: CategorySlice) => b.amount - a.amount),
    );
    setRecent(recentRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { income, expenses, slices, recent, loading, reload: load };
}

function SummaryCard({
  label,
  amount,
  color,
}: {
  label: string;
  amount: number;
  color: string;
}) {
  const format = useFormat();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        padding: 14,
        ...styles.shadow,
      }}
    >
      <Text
        style={{ fontSize: 12, color: theme.pageTextLight, marginBottom: 4 }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: 700, color }}>
        {format(amount, 'financial')}
      </Text>
    </View>
  );
}

function CategoryDonut({ slices }: { slices: CategorySlice[] }) {
  const { t } = useTranslation();
  const format = useFormat();

  const top = slices.slice(0, 6);
  const rest = slices.slice(6);
  const data = useMemo(() => {
    const items = top.map(s => ({
      name: s.name ?? t('Uncategorized'),
      value: s.amount,
    }));
    if (rest.length > 0) {
      items.push({
        name: t('More'),
        value: rest.reduce((sum, s) => sum + s.amount, 0),
      });
    }
    return items;
  }, [top, rest, t]);

  if (data.length === 0) {
    return (
      <Text style={{ color: theme.pageTextLight, padding: 10 }}>
        {t('No transactions yet')}
      </Text>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <PieChart width={140} height={140}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={40}
          outerRadius={65}
          paddingAngle={2}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              stroke="none"
            />
          ))}
        </Pie>
      </PieChart>
      <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
        {data.map((d, i) => (
          <View
            key={d.name}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
            <TextOneLine
              style={{ flex: 1, fontSize: 13, color: theme.pageText }}
            >
              {d.name}
            </TextOneLine>
            <Text style={{ fontSize: 13, color: theme.pageTextLight }}>
              {format(d.value, 'financial')}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecentTransactionRow({ transaction }: { transaction: RecentTransaction }) {
  const { t } = useTranslation();
  const format = useFormat();
  const isExpense = transaction.amount < 0;

  const day = transaction.date
    ? `${transaction.date.slice(8, 10)}/${transaction.date.slice(5, 7)}`
    : '';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderColor: theme.tableBorder,
        gap: 10,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <TextOneLine
          style={{ fontSize: 14, fontWeight: 600, color: theme.pageText }}
        >
          {transaction.payee || '—'}
        </TextOneLine>
        <TextOneLine style={{ fontSize: 12, color: theme.pageTextLight }}>
          {transaction.category || t('Uncategorized')}
          {transaction.account ? ` • ${transaction.account}` : ''}
        </TextOneLine>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: isExpense ? theme.errorText : theme.noticeText,
          }}
        >
          {format(transaction.amount, 'financial')}
        </Text>
        <Text style={{ fontSize: 12, color: theme.pageTextLight }}>{day}</Text>
      </View>
    </View>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        padding: 14,
        ...styles.shadow,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: 700, color: theme.pageText }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { income, expenses, slices, recent, loading, reload } = useHomeData();

  return (
    <Page
      header={<MobilePageHeader title={t('Home')} />}
      padding={0}
      style={{ backgroundColor: theme.mobilePageBackground }}
    >
      <PullToRefresh onRefresh={reload}>
        <View
          style={{
            padding: 12,
            gap: 12,
            paddingBottom: MOBILE_NAV_HEIGHT + 80,
          }}
        >
          {/* Saldo geral — hero card azul */}
          <View
            style={{
              backgroundColor: theme.mobileHeaderBackground,
              borderRadius: 12,
              padding: 18,
              ...styles.shadow,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: theme.mobileHeaderTextSubdued,
                marginBottom: 4,
              }}
            >
              {t('Current balance')}
            </Text>
            <CellValue
              binding={bindings.onBudgetAccountBalance()}
              type="financial"
            >
              {props => (
                <CellValueText<'account', 'onbudget-accounts-balance'>
                  {...props}
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: theme.mobileHeaderText,
                  }}
                />
              )}
            </CellValue>
          </View>

          {/* Receitas × Despesas do mês */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <SummaryCard
              label={t('Income this month')}
              amount={income}
              color={theme.noticeText}
            />
            <SummaryCard
              label={t('Expenses this month')}
              amount={-expenses}
              color={theme.errorText}
            />
          </View>

          {/* Gastos por categoria */}
          <SectionCard title={t('Spending by category')}>
            {loading ? (
              <Text style={{ color: theme.pageTextLight, padding: 10 }}>…</Text>
            ) : (
              <CategoryDonut slices={slices} />
            )}
          </SectionCard>

          {/* Transações recentes */}
          <SectionCard
            title={t('Recent transactions')}
            action={
              <Button
                variant="bare"
                onPress={() => navigate('/accounts/all')}
                style={{ color: theme.pageTextLink, fontSize: 13 }}
              >
                {t('See all')}
              </Button>
            }
          >
            {recent.length === 0 ? (
              <Text style={{ color: theme.pageTextLight, padding: 10 }}>
                {t('No transactions yet')}
              </Text>
            ) : (
              recent.map(transaction => (
                <RecentTransactionRow
                  key={transaction.id}
                  transaction={transaction}
                />
              ))
            )}
          </SectionCard>
        </View>
      </PullToRefresh>

      {/* FAB nova transação */}
      <Button
        variant="primary"
        aria-label={t('Add transaction')}
        onPress={() => navigate('/transactions/new')}
        style={{
          position: 'fixed',
          bottom: MOBILE_NAV_HEIGHT + 16,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 101,
          ...styles.shadowLarge,
        }}
      >
        <SvgAdd width={22} height={22} />
      </Button>
    </Page>
  );
}
