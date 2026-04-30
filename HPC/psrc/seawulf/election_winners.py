from gerrychain import Election


def build_election_updater(name: str, d_col: str, r_col: str) -> Election:
    """Return a gerrychain.Election updater bound to the given vote columns."""
    return Election(
        name,
        {"Democratic": d_col, "Republican": r_col},
        alias=name,
    )


def district_winners(partition, election_key: str = "PRES24") -> dict:
    """Return {district_id: 'Democratic' | 'Republican'} for one partition."""
    election = partition[election_key]
    return {
        d: "Democratic" if election.won("Democratic", d) else "Republican"
        for d in partition.parts
    }


def party_seat_count(partition, party: str, election_key: str = "PRES24") -> int:
    """Return the number of districts where `party` wins."""
    return partition[election_key].wins(party)
