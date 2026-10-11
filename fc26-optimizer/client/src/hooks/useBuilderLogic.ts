  const totalFacilityCost = useMemo(() => {
    return Object.entries(equippedFacilities).reduce((total, [name, tier]) => {
      return total + (FACILITIES[name]?.cost[tier - 1] || 0);
    }, 0);
  }, [equippedFacilities]);

  // FIX: Use CLUB_BUDGETS lookup instead of a hardcoded number
  const totalClubBudget = CLUB_BUDGETS[clubLevel] || 1000000;
  const remainingBudget = totalClubBudget - totalFacilityCost;
