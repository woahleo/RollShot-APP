-- Let signed-out visitors open a car's page when the owner has it switched on.
-- The "public cars" rule already limits this to cars marked public; this grant just lets
-- signed-out visitors use it, the same as signed-in ones. Safe to run more than once.
grant select on public.cars to anon;
