-- auth.uid() 를 (select ...) 로 감싸 행마다 재평가되지 않게 한다
alter policy "나와 상대 프로필 조회" on public.profiles
  using (id = (select auth.uid()) or couple_id = (select private.my_couple_id()));
alter policy "내 프로필만 수정" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "커플 구성원만 조회" on public.couples
  using (id = (select private.my_couple_id()));
alter policy "커플 구성원만 수정" on public.couples
  using (id = (select private.my_couple_id())) with check (id = (select private.my_couple_id()));
